import { useEffect } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, useFieldArray, Controller } from "react-hook-form"
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
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"

const breakdownRowSchema = z.object({
  component: z.string().min(1, "Required"),
  note: z.string().optional().default(""),
})

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  breakdownItems: z.array(breakdownRowSchema).optional().default([]),
  panelSize: z.string().optional(),
  price: z.coerce.number().min(0),
  defaultQty: z.coerce.number().int().min(1),
})

type FormValues = z.infer<typeof formSchema>

/* Storage stays a single "Component - Note" per-line string; only this admin form treats it as structured rows. */
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

function serializeBreakdown(items: { component: string; note: string }[]): string {
  return items
    .filter((i) => i.component.trim().length > 0)
    .map((i) => (i.note.trim() ? `${i.component} - ${i.note}` : i.component))
    .join("\n")
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
      breakdownItems: [],
      panelSize: "",
      price: 0,
      defaultQty: 1,
    },
  })

  const { fields: breakdownFields, append: appendBreakdownRow, remove: removeBreakdownRow } = useFieldArray({
    control: form.control,
    name: "breakdownItems",
  })

  useEffect(() => {
    if (panel) {
      form.reset({
        name: panel.name,
        breakdownItems: parseBreakdown(panel.breakdownText),
        panelSize: panel.panelSize,
        price: panel.price,
        defaultQty: panel.defaultQty,
      })
    }
  }, [panel, form])

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      panelSize: values.panelSize,
      price: values.price,
      defaultQty: values.defaultQty,
      breakdownText: serializeBreakdown(values.breakdownItems),
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Component Breakdown</label>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => appendBreakdownRow({ component: "", note: "" })}>
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
                              <Button type="button" variant="ghost" size="icon"
                                className="h-8 w-8 text-destructive" onClick={() => removeBreakdownRow(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-2">Each row prints as one line on the quotation.</p>
              </div>

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
