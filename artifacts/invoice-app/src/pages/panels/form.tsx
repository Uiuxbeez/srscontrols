import { useEffect } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useCreatePanel, useUpdatePanel, useGetPanel, getGetPanelQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"

const breakdownRowSchema = z.object({
  component: z.string().min(1, "Required"),
  note: z.string().optional().default(""),
  price: z.coerce.number().min(0).optional().default(0),
})

const PANEL_CATEGORIES = ["Manufacturing", "Licensing", "Erection", "Trading"] as const

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  breakdownItems: z.array(breakdownRowSchema).optional().default([]),
  panelSize: z.string().optional(),
  frameSize: z.string().optional(),
  price: z.coerce.number().min(0),
  defaultQty: z.coerce.number().int().min(1),
})

type FormValues = z.infer<typeof formSchema>

/* breakdownText stays a plain "Component - Note" per-line string — the only thing ever printed on a
   quotation. Per-component price is admin-only bookkeeping, stored separately as a JSON price array
   in componentPricing, aligned by index to the same lines, so it can never leak into the printed template. */
function parseBreakdown(text: string): { component: string; note: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf(" - ")
      if (idx === -1) return { component: line, note: "" }
      return { component: line.slice(0, idx), note: line.slice(idx + 3) }
    })
}

function parsePricing(json: string): number[] {
  try {
    const arr = JSON.parse(json)
    if (Array.isArray(arr)) return arr.map((n) => (typeof n === "number" ? n : Number(n) || 0))
  } catch {
    // ignore malformed/legacy data — rows just default to price 0
  }
  return []
}

export default function PanelForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const panelId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: panel, isLoading } = useGetPanel(panelId as number, {
    query: {
      enabled: !!panelId,
      queryKey: getGetPanelQueryKey(panelId as number)
    }
  })

  const createPanel = useCreatePanel()
  const updatePanel = useUpdatePanel()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      breakdownItems: [],
      panelSize: "",
      frameSize: "",
      price: 0,
      defaultQty: 1,
    },
  })

  const { fields: breakdownFields, append: appendBreakdownRow, remove: removeBreakdownRow } = useFieldArray({
    control: form.control,
    name: "breakdownItems",
  })

  const watchedBreakdownItems = useWatch({ control: form.control, name: "breakdownItems" }) ?? []
  const componentTotal = watchedBreakdownItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0)

  const watchedPanelSize = useWatch({ control: form.control, name: "panelSize" })
  useEffect(() => {
    if (isNew) form.setValue("frameSize", watchedPanelSize ?? "")
  }, [watchedPanelSize, isNew, form])

  useEffect(() => {
    if (panel) {
      const baseRows = parseBreakdown(panel.breakdownText)
      const prices = parsePricing(panel.componentPricing ?? "[]")
      form.reset({
        name: panel.name,
        category: panel.category,
        breakdownItems: baseRows.map((row, i) => ({ ...row, price: prices[i] ?? 0 })),
        panelSize: panel.panelSize,
        frameSize: panel.frameSize,
        price: panel.price,
        defaultQty: panel.defaultQty,
      })
    }
  }, [panel, form])

  function onSubmit(values: FormValues) {
    const validItems = values.breakdownItems.filter((i) => i.component.trim().length > 0)
    const payload = {
      name: values.name,
      category: values.category as (typeof PANEL_CATEGORIES)[number],
      panelSize: values.panelSize,
      frameSize: values.frameSize,
      price: values.price,
      defaultQty: values.defaultQty,
      breakdownText: validItems.map((i) => (i.note.trim() ? `${i.component} - ${i.note}` : i.component)).join("\n"),
      componentPricing: JSON.stringify(validItems.map((i) => i.price ?? 0)),
    }
    if (isNew) {
      createPanel.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Panel created successfully" })
          setLocation("/panels")
        },
        onError: () => {
          toast({ title: "Failed to create panel", variant: "destructive" })
        }
      })
    } else {
      updatePanel.mutate({ id: panelId as number, data: payload }, {
        onSuccess: (updatedData) => {
          toast({ title: "Panel updated successfully" })
          queryClient.setQueryData(getGetPanelQueryKey(panelId as number), updatedData)
          setLocation("/panels")
        },
        onError: () => {
          toast({ title: "Failed to update panel", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createPanel.isPending || updatePanel.isPending

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/panels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Add Panel" : "Edit Panel"}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Add a new reusable panel product." : "Update the panel product."}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="63A 4P MCCB Enclosure" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PANEL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Component Breakdown</label>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => appendBreakdownRow({ component: "", note: "", price: 0 })}>
                    <Plus className="w-4 h-4 mr-1" /> Add Row
                  </Button>
                </div>
                {breakdownFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No components added yet.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground bg-muted/50 border-b">
                        <tr>
                          <th className="p-2 w-12 text-center">#</th>
                          <th className="p-2">Component</th>
                          <th className="p-2">Note / Qty</th>
                          <th className="p-2 w-28">Price (₹)</th>
                          <th className="p-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {breakdownFields.map((field, index) => (
                          <tr key={field.id}>
                            <td className="p-2 text-center text-muted-foreground">{index + 1}</td>
                            <td className="p-2">
                              <Controller
                                control={form.control}
                                name={`breakdownItems.${index}.component`}
                                render={({ field }) => (
                                  <Input className="h-8" placeholder="63A 4P MCCB Rotary Handle with Spreader Link (DN0-100C)" {...field} />
                                )}
                              />
                            </td>
                            <td className="p-2">
                              <Controller
                                control={form.control}
                                name={`breakdownItems.${index}.note`}
                                render={({ field }) => (
                                  <Input className="h-8" placeholder="1 NO" {...field} />
                                )}
                              />
                            </td>
                            <td className="p-2">
                              <Controller
                                control={form.control}
                                name={`breakdownItems.${index}.price`}
                                render={({ field }) => (
                                  <Input className="h-8" type="number" step="0.01" {...field} />
                                )}
                              />
                            </td>
                            <td className="p-2">
                              <Button type="button" variant="ghost" size="icon"
                                className="h-8 w-8 text-destructive" onClick={() => removeBreakdownRow(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td colSpan={3} className="p-2 text-right text-sm font-medium">Total</td>
                          <td className="p-2 text-sm font-semibold">₹{componentTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Each row prints as one line on the quotation — <span className="font-medium">Price is internal only and never appears on the printed quotation</span>, only the Total above is for your reference.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="panelSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel Size</FormLabel>
                      <FormControl>
                        <Input placeholder="500mm X 300mm X 200mm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frameSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frame Size</FormLabel>
                      <FormControl>
                        <Input placeholder="500mm X 300mm X 200mm" {...field} />
                      </FormControl>
                      <FormDescription>Defaults to Panel Size — edit here if it needs to differ.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>Per-unit rate.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Qty</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {isPending ? "Saving..." : "Save Panel"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
