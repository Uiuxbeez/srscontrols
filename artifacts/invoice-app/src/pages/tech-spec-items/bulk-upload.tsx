import { useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import { useListTechSpecItems } from "@workspace/api-client-react"
import { useBulkImportTechSpecItems } from "@/lib/tech-spec-bulk-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Trash2, Plus, Upload, Download } from "lucide-react"

interface DraftRow {
  itemName: string
  defaultSpec: string
  include: boolean
}

/* Minimal RFC4180-ish CSV parser: handles quoted fields, escaped "" quotes, and CRLF/LF line endings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.some((c) => c.trim().length > 0)) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim().length > 0)) rows.push(row)
  }
  return rows
}

/* Header names are matched by label so both "S.No, Item Name, Default Spec" and the older
   2-column "Item Name, Default Spec" format work; S.No (if present) is read and ignored. */
function detectColumns(headerRow: string[]): { itemNameIdx: number; specIdx: number } | null {
  const norm = headerRow.map((c) => c.trim().toLowerCase())
  const itemNameIdx = norm.findIndex((c) => c === "item name" || c === "itemname" || c === "item")
  if (itemNameIdx === -1) return null
  const specIdx = norm.findIndex((c) => c === "default spec" || c === "defaultspec" || c === "spec" || c === "specification")
  return { itemNameIdx, specIdx: specIdx === -1 ? itemNameIdx + 1 : specIdx }
}

function downloadCsvTemplate() {
  const csv = "S.No,Item Name,Default Spec\n1,SHEET,Tata Sheet usage only\n2,POWDER COATING,Powder coated as per IS:5\n"
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "tech-spec-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function TechSpecBulkUpload() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { data: existingItems } = useListTechSpecItems()
  const bulkImport = useBulkImportTechSpecItems()

  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<DraftRow[]>([])

  const existingNames = useMemo(
    () => new Set((existingItems ?? []).map((i) => i.itemName.trim().toLowerCase())),
    [existingItems],
  )

  const duplicateFlags = useMemo(() => {
    const seenInBatch = new Set<string>()
    return rows.map((row) => {
      const key = row.itemName.trim().toLowerCase()
      if (!key) return false
      const isDup = existingNames.has(key) || seenInBatch.has(key)
      seenInBatch.add(key)
      return isDup
    })
  }, [rows, existingNames])

  function handleReadCsv() {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? "")
      const csvRows = parseCsv(text)
      if (csvRows.length === 0) {
        toast({ title: "No rows found in that CSV", variant: "destructive" })
        return
      }
      const headerCols = detectColumns(csvRows[0] ?? [])
      const colCount = csvRows[0]?.length ?? 2
      const dataRows = headerCols ? csvRows.slice(1) : csvRows
      const itemNameIdx = headerCols ? headerCols.itemNameIdx : colCount >= 3 ? 1 : 0
      const specIdx = headerCols ? headerCols.specIdx : colCount >= 3 ? 2 : 1

      const parsedRows: DraftRow[] = dataRows
        .filter((r) => (r[itemNameIdx] ?? "").trim().length > 0)
        .map((r) => ({ itemName: (r[itemNameIdx] ?? "").trim(), defaultSpec: (r[specIdx] ?? "").trim(), include: true }))

      const seenInFile = new Set<string>()
      let dupCount = 0
      for (const r of parsedRows) {
        const key = r.itemName.toLowerCase()
        if (existingNames.has(key) || seenInFile.has(key)) dupCount++
        seenInFile.add(key)
      }

      setRows(parsedRows)
      toast({
        title: `Read ${parsedRows.length} row(s) — check the preview below`,
        description: dupCount ? `${dupCount} duplicate row(s) detected — flagged below and will be ignored.` : undefined,
      })
    }
    reader.onerror = () => toast({ title: "Failed to read CSV", variant: "destructive" })
    reader.readAsText(file)
  }

  function updateRow(index: number, field: "itemName" | "defaultSpec", value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function toggleInclude(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, include: !r.include } : r)))
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlankRow() {
    setRows((prev) => [...prev, { itemName: "", defaultSpec: "", include: true }])
  }

  const includedCount = rows.filter((r, i) => r.include && r.itemName.trim() && !duplicateFlags[i]).length

  function handleSubmit() {
    const payload = rows
      .filter((r, i) => r.include && r.itemName.trim() && r.defaultSpec.trim() && !duplicateFlags[i])
      .map((r) => ({ itemName: r.itemName.trim(), defaultSpec: r.defaultSpec.trim() }))

    if (payload.length === 0) {
      toast({ title: "Nothing to add", description: "Check at least one non-duplicate row with both fields filled.", variant: "destructive" })
      return
    }

    bulkImport.mutate(payload, {
      onSuccess: (res) => {
        toast({
          title: `Added ${res.inserted.length} item(s)`,
          description: res.skipped.length ? `${res.skipped.length} duplicate(s) ignored: ${res.skipped.join(", ")}` : undefined,
        })
        setLocation("/tech-spec-items")
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/tech-spec-items"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Upload Tech Specs</h1>
          <p className="text-muted-foreground">Upload a CSV of item/spec pairs, review the rows, then add them.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upload CSV</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Button type="button" onClick={handleReadCsv} disabled={!file}>
            <Upload className="w-4 h-4 mr-2" />
            Read CSV
          </Button>
        </CardContent>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Columns: <span className="font-medium">S.No</span> (reference only, ignored on import), <span className="font-medium">Item Name</span>, <span className="font-medium">Default Spec</span>. A header row is optional — it's detected and skipped automatically.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Preview — {includedCount} will be added</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addBlankRow}>
              <Plus className="w-4 h-4 mr-1" /> Add Row
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Rows already in Tech Spec Master (or repeated in this batch) are flagged as duplicates and will be ignored.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                  <tr>
                    <th className="p-2 w-10" />
                    <th className="p-2 text-left">Item Name</th>
                    <th className="p-2 text-left">Default Spec</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, i) => {
                    const isDup = duplicateFlags[i]
                    return (
                      <tr key={i} className={isDup ? "bg-destructive/5" : undefined}>
                        <td className="p-2">
                          <Checkbox checked={row.include} onCheckedChange={() => toggleInclude(i)} />
                        </td>
                        <td className="p-2">
                          <Input className="h-8" value={row.itemName} onChange={(e) => updateRow(i, "itemName", e.target.value)} />
                          {isDup && <div className="text-[11px] text-destructive mt-1">Duplicate — will be ignored</div>}
                        </td>
                        <td className="p-2">
                          <Input className="h-8" value={row.defaultSpec} onChange={(e) => updateRow(i, "defaultSpec", e.target.value)} />
                        </td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => setLocation("/tech-spec-items")}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={bulkImport.isPending}>
            {bulkImport.isPending ? "Adding..." : `Add ${includedCount} Item(s)`}
          </Button>
        </div>
      )}
    </div>
  )
}
