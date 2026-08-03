import { useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import { useListPanels } from "@workspace/api-client-react"
import { useBulkImportPanelComponents } from "@/lib/panel-bulk-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Trash2, Plus, Upload, Download } from "lucide-react"

interface DraftRow {
  component: string
  note: string
  include: boolean
}

/* Minimal RFC4180-ish CSV parser: handles quoted fields, escaped "" quotes, and CRLF/LF endings. */
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

function detectColumns(headerRow: string[]): { componentIdx: number; qtyIdx: number } | null {
  const norm = headerRow.map((c) => c.trim().toLowerCase())
  const componentIdx = norm.findIndex((c) => c === "component breakdown" || c === "component" || c === "breakdown")
  if (componentIdx === -1) return null
  const qtyIdx = norm.findIndex((c) => c === "qty" || c === "quantity" || c === "note")
  return { componentIdx, qtyIdx: qtyIdx === -1 ? componentIdx + 1 : qtyIdx }
}

function downloadCsvTemplate() {
  const csv = "Component Breakdown,Qty\n100A FUSE,3\n200A FUSE,3\nFRAME,1\n"
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "panel-components-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function PanelsBulkUpload() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { data: panels } = useListPanels()
  const bulkImport = useBulkImportPanelComponents()

  const [panelName, setPanelName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<DraftRow[]>([])

  const panelOptions = useMemo(() => (panels ?? []).map((p) => ({ id: p.id, label: p.name })), [panels])

  const existingLines = useMemo(() => {
    const panel = panels?.find((p) => p.name.trim().toLowerCase() === panelName.trim().toLowerCase())
    if (!panel) return new Set<string>()
    return new Set(panel.breakdownText.split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean))
  }, [panels, panelName])

  const duplicateFlags = useMemo(() => {
    const seenInBatch = new Set<string>()
    return rows.map((row) => {
      if (!row.component.trim()) return false
      const line = (row.note.trim() ? `${row.component.trim()} - ${row.note.trim()}` : row.component.trim()).toLowerCase()
      const isDup = existingLines.has(line) || seenInBatch.has(line)
      seenInBatch.add(line)
      return isDup
    })
  }, [rows, existingLines])

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
      const dataRows = headerCols ? csvRows.slice(1) : csvRows
      const componentIdx = headerCols ? headerCols.componentIdx : 0
      const qtyIdx = headerCols ? headerCols.qtyIdx : 1

      const parsedRows: DraftRow[] = dataRows
        .filter((r) => (r[componentIdx] ?? "").trim().length > 0)
        .map((r) => ({
          component: (r[componentIdx] ?? "").trim(),
          note: (r[qtyIdx] ?? "").trim(),
          include: true,
        }))

      setRows(parsedRows)
      toast({ title: `Read ${parsedRows.length} row(s) — check the preview below` })
    }
    reader.onerror = () => toast({ title: "Failed to read CSV", variant: "destructive" })
    reader.readAsText(file)
  }

  function updateRow(index: number, field: "component" | "note", value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function toggleInclude(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, include: !r.include } : r)))
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlankRow() {
    setRows((prev) => [...prev, { component: "", note: "", include: true }])
  }

  const includedCount = rows.filter((r, i) => r.include && r.component.trim() && !duplicateFlags[i]).length

  function handleSubmit() {
    if (!panelName.trim()) {
      toast({ title: "Enter a panel name first", variant: "destructive" })
      return
    }
    const components = rows
      .filter((r, i) => r.include && r.component.trim() && !duplicateFlags[i])
      .map((r) => ({ component: r.component.trim(), note: r.note.trim() }))

    if (components.length === 0) {
      toast({ title: "Nothing to add", description: "Check at least one non-duplicate row with a component name.", variant: "destructive" })
      return
    }

    bulkImport.mutate(
      { panelName: panelName.trim(), components },
      {
        onSuccess: (res) => {
          toast({
            title: `${res.created ? "Created panel and added" : "Added"} ${res.added} component(s) to "${res.panel.name}"`,
            description: res.skipped.length ? `${res.skipped.length} duplicate(s) already on this panel were ignored.` : undefined,
          })
          setLocation("/panels")
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      },
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/panels"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Upload Panel Components</h1>
          <p className="text-muted-foreground">Pick (or name) a panel, then bulk-add its component breakdown from a CSV.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Panel</CardTitle></CardHeader>
        <CardContent>
          <label className="text-sm font-medium mb-1 block">Panel Name</label>
          <AutocompleteInput
            value={panelName}
            onValueChange={setPanelName}
            options={panelOptions}
            placeholder="Search an existing panel, or type a new name to create one..."
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Pick an existing panel to append these components to it, or type a new name to create one. Category, size, and price aren't set here — add those afterward.
          </p>
        </CardContent>
      </Card>

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
            Columns: <span className="font-medium">Component Breakdown</span>, <span className="font-medium">Qty</span>. A header row is optional — it's detected and skipped automatically.
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
              Rows already on this panel (or repeated in this batch) are flagged as duplicates and will be ignored.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                  <tr>
                    <th className="p-2 w-10" />
                    <th className="p-2 text-left">Component Breakdown</th>
                    <th className="p-2 w-28 text-left">Qty</th>
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
                          <Input className="h-8" value={row.component} onChange={(e) => updateRow(i, "component", e.target.value)} />
                          {isDup && <div className="text-[11px] text-destructive mt-1">Duplicate — will be ignored</div>}
                        </td>
                        <td className="p-2">
                          <Input className="h-8" value={row.note} onChange={(e) => updateRow(i, "note", e.target.value)} />
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
          <Button type="button" variant="outline" onClick={() => setLocation("/panels")}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={bulkImport.isPending}>
            {bulkImport.isPending ? "Adding..." : `Add ${includedCount} Component(s)`}
          </Button>
        </div>
      )}
    </div>
  )
}
