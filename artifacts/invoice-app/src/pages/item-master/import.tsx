import { useState } from "react"
import { Link, useLocation } from "wouter"
import { useListCategories, useListSubCategories } from "@workspace/api-client-react"
import { useParsePdf, useImportItemMaster } from "@/lib/item-master-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Trash2, Plus, Upload } from "lucide-react"

interface DraftItem {
  name: string
  catNo: string
  price: string
  packQty: string
  specifications: string
}

interface SubCategoryBucket {
  name: string
  items: DraftItem[]
}

/* Best-effort split of one OCR'd line into rough item fields — always keeps the full raw line in specifications as a fallback */
function splitLineHeuristic(line: string): DraftItem {
  const tokens = line.split(/\s+/).filter(Boolean)
  let price: string | null = null
  let packQty: string | null = null
  let catNo: string | null = null
  const rest: string[] = []
  for (const token of tokens) {
    const clean = token.replace(/,/g, "")
    if (price === null && /^\d{3,}(\.\d{1,2})?$/.test(clean)) {
      price = clean
      continue
    }
    if (packQty === null && /^\d{1,2}$/.test(clean)) {
      packQty = clean
      continue
    }
    if (catNo === null && /^[A-Za-z]{1,4}\d{3,}$/.test(clean)) {
      catNo = clean
      continue
    }
    rest.push(token)
  }
  return {
    name: rest.join(" ") || line,
    catNo: catNo ?? "",
    price: price ?? "",
    packQty: packQty ?? "",
    specifications: line,
  }
}

export default function ItemMasterImport() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { data: categories } = useListCategories()
  const { data: subCategories } = useListSubCategories()
  const parsePdf = useParsePdf()
  const importItemMaster = useImportItemMaster()

  const [step, setStep] = useState<1 | 2>(1)
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<{ pageNumber: number; lines: string[] }[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [categoryName, setCategoryName] = useState("")
  const [buckets, setBuckets] = useState<SubCategoryBucket[]>([])

  const categoryOptions = (categories ?? []).map((c) => ({ id: c.id, label: c.name }))
  const subCategoryOptions = (subCategories ?? []).map((s) => ({ id: s.id, label: s.name }))

  function lineKey(pageNumber: number, lineIndex: number) {
    return `${pageNumber}-${lineIndex}`
  }

  function toggleLine(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function getCheckedLineTexts(): string[] {
    const texts: string[] = []
    for (const page of pages) {
      page.lines.forEach((line, idx) => {
        if (checked.has(lineKey(page.pageNumber, idx))) texts.push(line)
      })
    }
    return texts
  }

  async function handleReadPdf() {
    if (!file) return
    parsePdf.mutate(file, {
      onSuccess: (data) => {
        setPages(data.pages)
        setChecked(new Set())
        toast({ title: `Read ${data.pages.length} page(s)` })
      },
      onError: () => toast({ title: "Failed to read PDF", variant: "destructive" }),
    })
  }

  function handleMarkCategory() {
    const texts = getCheckedLineTexts()
    if (texts.length !== 1) {
      toast({ title: "Check exactly one line to use as the category name", variant: "destructive" })
      return
    }
    setCategoryName(texts[0]!)
    setChecked(new Set())
  }

  function handleNewSubCategory() {
    const texts = getCheckedLineTexts()
    if (texts.length !== 1) {
      toast({ title: "Check exactly one line to use as the sub-category name", variant: "destructive" })
      return
    }
    setBuckets((prev) => [...prev, { name: texts[0]!, items: [] }])
    setChecked(new Set())
  }

  function handleAddToBucket(bucketIndex: number) {
    const texts = getCheckedLineTexts()
    if (texts.length === 0) {
      toast({ title: "Check at least one line to add", variant: "destructive" })
      return
    }
    setBuckets((prev) =>
      prev.map((b, i) => (i === bucketIndex ? { ...b, items: [...b.items, ...texts.map(splitLineHeuristic)] } : b)),
    )
    setChecked(new Set())
  }

  function handleRemoveBucket(bucketIndex: number) {
    setBuckets((prev) => prev.filter((_, i) => i !== bucketIndex))
  }

  function renameBucket(bucketIndex: number, name: string) {
    setBuckets((prev) => prev.map((b, i) => (i === bucketIndex ? { ...b, name } : b)))
  }

  function updateItem(bucketIndex: number, itemIndex: number, field: keyof DraftItem, value: string) {
    setBuckets((prev) =>
      prev.map((b, i) =>
        i === bucketIndex
          ? { ...b, items: b.items.map((item, j) => (j === itemIndex ? { ...item, [field]: value } : item)) }
          : b,
      ),
    )
  }

  function removeItem(bucketIndex: number, itemIndex: number) {
    setBuckets((prev) =>
      prev.map((b, i) => (i === bucketIndex ? { ...b, items: b.items.filter((_, j) => j !== itemIndex) } : b)),
    )
  }

  function addBlankItem(bucketIndex: number) {
    setBuckets((prev) =>
      prev.map((b, i) =>
        i === bucketIndex
          ? { ...b, items: [...b.items, { name: "", catNo: "", price: "", packQty: "", specifications: "" }] }
          : b,
      ),
    )
  }

  const totalItems = buckets.reduce((sum, b) => sum + b.items.length, 0)
  const canProceed = categoryName.trim().length > 0 && buckets.length > 0 && totalItems > 0

  function handleSave() {
    importItemMaster.mutate(
      {
        categoryName,
        subCategories: buckets
          .filter((b) => b.items.length > 0)
          .map((b) => ({
            name: b.name,
            items: b.items
              .filter((item) => item.name.trim().length > 0)
              .map((item) => ({
                name: item.name,
                catNo: item.catNo || undefined,
                price: item.price ? Number(item.price) : null,
                packQty: item.packQty ? Number(item.packQty) : null,
                specifications: item.specifications || undefined,
              })),
          })),
      },
      {
        onSuccess: () => {
          toast({ title: "Saved to Item Master" })
          setLocation("/item-master")
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      },
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/item-master"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import from PDF</h1>
          <p className="text-muted-foreground">
            {step === 1 ? "Step 1 of 2: Upload and tag the extracted text." : "Step 2 of 2: Review and fix item rows before saving."}
          </p>
        </div>
      </div>

      {step === 1 && (
        <>
          <Card>
            <CardHeader><CardTitle>Upload PDF</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <Button type="button" onClick={handleReadPdf} disabled={!file || parsePdf.isPending}>
                <Upload className="w-4 h-4 mr-2" />
                {parsePdf.isPending ? "Reading (OCR can take a while)..." : "Read PDF"}
              </Button>
            </CardContent>
          </Card>

          {pages.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <Card>
                <CardHeader><CardTitle>Extracted Text</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    OCR best-effort — expect misreads and, on multi-column pages, interleaved lines from side-by-side tables. Check lines below, then tag them on the right.
                  </p>
                  {pages.map((page) => (
                    <div key={page.pageNumber}>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Page {page.pageNumber}</div>
                      <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                        {page.lines.map((line, idx) => {
                          const key = lineKey(page.pageNumber, idx)
                          return (
                            <label key={key} className="flex items-start gap-2 p-2 text-sm hover:bg-muted/40 cursor-pointer">
                              <Checkbox
                                checked={checked.has(key)}
                                onCheckedChange={() => toggleLine(key)}
                                className="mt-0.5"
                              />
                              <span className="font-mono text-xs">{line}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Category</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <AutocompleteInput
                      value={categoryName}
                      onValueChange={setCategoryName}
                      options={categoryOptions}
                      placeholder="Category name"
                    />
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleMarkCategory}>
                      Use checked line as category
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Sub-Categories</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleNewSubCategory}>
                      <Plus className="w-4 h-4 mr-1" /> New sub-category from checked line
                    </Button>
                    {buckets.map((bucket, i) => (
                      <div key={i} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <AutocompleteInput
                            value={bucket.name}
                            onValueChange={(v) => renameBucket(i, v)}
                            options={subCategoryOptions}
                            className="flex-1"
                          />
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveBucket(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">{bucket.items.length} item(s)</div>
                        <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => handleAddToBucket(i)}>
                          Add checked lines here
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button type="button" className="w-full" disabled={!canProceed} onClick={() => setStep(2)}>
                  Next: Review Items →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader><CardTitle>Category</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{categoryName}</div>
            </CardContent>
          </Card>

          {buckets.map((bucket, bi) => (
            <Card key={bi}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>{bucket.name}</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => addBlankItem(bi)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Row
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                      <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left w-32">Cat No.</th>
                        <th className="p-2 text-left w-28">Price</th>
                        <th className="p-2 text-left w-24">Pack Qty</th>
                        <th className="p-2 text-left">Specifications</th>
                        <th className="p-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bucket.items.map((item, ii) => (
                        <tr key={ii}>
                          <td className="p-2">
                            <Input className="h-8" value={item.name} onChange={(e) => updateItem(bi, ii, "name", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-8" value={item.catNo} onChange={(e) => updateItem(bi, ii, "catNo", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-8" type="number" value={item.price} onChange={(e) => updateItem(bi, ii, "price", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-8" type="number" value={item.packQty} onChange={(e) => updateItem(bi, ii, "packQty", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-8" value={item.specifications} onChange={(e) => updateItem(bi, ii, "specifications", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(bi, ii)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button type="button" onClick={handleSave} disabled={importItemMaster.isPending}>
              {importItemMaster.isPending ? "Saving..." : "Save to Item Master"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
