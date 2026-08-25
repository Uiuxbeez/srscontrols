import { useEffect, useMemo } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useGetPurchaseOrder,
  useListClients,
  useListPurchaseItemMaster,
  useGetNextPurchaseOrderNumber,
  getGetPurchaseOrderQueryKey,
  getGetNextPurchaseOrderNumberQueryKey,
  getListPurchaseItemMasterQueryKey
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { Link } from "wouter"
import { isInterState } from "@/lib/gst"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

const itemSchema = z.object({
  sNo: z.number(),
  description: z.string().min(1, "Required"),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  qty: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  per: z.string().optional(),
  amount: z.coerce.number().min(0)
})

const formSchema = z.object({
  poNo: z.coerce.number().min(1),
  date: z.string().min(1, "Date is required"),
  clientId: z.coerce.number().min(1, "Client is required"),
  deliveryLocation: z.string().optional(),
  termsOfDelivery: z.string().optional(),
  modeOfPayment: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  cgstRate: z.coerce.number(),
  sgstRate: z.coerce.number(),
})

type FormValues = z.infer<typeof formSchema>

function calcAmount(qty?: number, rate?: number, discountPct?: number): number {
  if (!qty || !rate) return 0
  const gross = qty * rate
  const discount = discountPct ? (gross * discountPct) / 100 : 0
  return gross - discount
}

export default function PurchaseOrderForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const poId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: clients, isLoading: clientsLoading } = useListClients()
  const { data: nextNumData } = useGetNextPurchaseOrderNumber({ query: { enabled: isNew, queryKey: getGetNextPurchaseOrderNumberQueryKey() } })
  const { data: po, isLoading: poLoading } = useGetPurchaseOrder(poId as number, {
    query: {
      enabled: !!poId,
      queryKey: getGetPurchaseOrderQueryKey(poId as number)
    }
  })

  const createPo = useCreatePurchaseOrder()
  const updatePo = useUpdatePurchaseOrder()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poNo: 1,
      date: new Date().toISOString().split('T')[0],
      clientId: 0,
      deliveryLocation: "",
      termsOfDelivery: "",
      modeOfPayment: "",
      notes: "",
      cgstRate: 9,
      sgstRate: 9,
      items: [{ sNo: 1, description: "", discountPct: 0, qty: 1, rate: 0, per: "Nos", amount: 0 }]
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  const watchItems = useWatch({ control: form.control, name: "items" })
  const watchCgstRate = useWatch({ control: form.control, name: "cgstRate" }) || 0
  const watchSgstRate = useWatch({ control: form.control, name: "sgstRate" }) || 0
  const watchClientId = useWatch({ control: form.control, name: "clientId" })

  const selectedClient = clients?.find((c) => c.id === watchClientId)
  const interState = isInterState(selectedClient?.gstin)

  const { data: masterItems } = useListPurchaseItemMaster(
    { clientId: watchClientId },
    { query: { enabled: !!watchClientId, queryKey: getListPurchaseItemMasterQueryKey({ clientId: watchClientId }) } },
  )
  const selectedDescriptions = new Set(
    watchItems.map((i) => (i?.description ?? "").trim().toLowerCase()).filter(Boolean),
  )

  function toggleMasterItem(entry: NonNullable<typeof masterItems>[number]) {
    const key = entry.description.trim().toLowerCase()
    const idx = watchItems.findIndex((i) => (i?.description ?? "").trim().toLowerCase() === key)
    if (idx !== -1) {
      remove(idx)
    } else {
      append({
        sNo: fields.length + 1,
        description: entry.description,
        discountPct: entry.discountPct ?? 0,
        qty: 1,
        rate: entry.rate ?? 0,
        per: entry.per || "Nos",
        amount: calcAmount(1, entry.rate ?? 0, entry.discountPct ?? 0),
      })
    }
  }

  // Auto-calculate item amounts from qty × rate × (1 - discount%)
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('items.') && (name.endsWith('.qty') || name.endsWith('.rate') || name.endsWith('.discountPct'))) {
        const match = name.match(/items\.(\d+)/)
        if (match) {
          const index = parseInt(match[1], 10)
          const item = value.items?.[index]
          if (item) {
            form.setValue(`items.${index}.amount`, calcAmount(Number(item.qty) || 0, Number(item.rate) || 0, Number(item.discountPct) || 0))
          }
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const totals = useMemo(() => {
    const subtotal = watchItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    const cgstAmount = (subtotal * watchCgstRate) / 100
    const sgstAmount = (subtotal * watchSgstRate) / 100
    const total = subtotal + cgstAmount + sgstAmount
    const netTotal = Math.round(total)
    const roundOff = netTotal - total
    return { subtotal, cgstAmount, sgstAmount, roundOff, netTotal }
  }, [watchItems, watchCgstRate, watchSgstRate])

  useEffect(() => {
    if (isNew && nextNumData) {
      form.setValue("poNo", nextNumData.nextNumber)
    }
  }, [isNew, nextNumData, form])

  useEffect(() => {
    if (po) {
      form.reset({
        poNo: po.poNo,
        date: po.date.split('T')[0],
        clientId: po.clientId,
        deliveryLocation: po.deliveryLocation || "",
        termsOfDelivery: po.termsOfDelivery || "",
        modeOfPayment: po.modeOfPayment || "",
        notes: po.notes || "",
        cgstRate: po.cgstRate,
        sgstRate: po.sgstRate,
        items: po.items.map(item => ({
          sNo: item.sNo,
          description: item.description,
          discountPct: item.discountPct || 0,
          qty: item.qty || undefined,
          rate: item.rate || undefined,
          per: item.per || "",
          amount: item.amount
        }))
      })
    }
  }, [po, form])

  function onSubmit(values: FormValues) {
    if (isNew) {
      createPo.mutate({ data: values }, {
        onSuccess: (data) => {
          toast({ title: "Purchase order created successfully" })
          setLocation(`/purchase-orders/${data.id}`)
        },
        onError: () => {
          toast({ title: "Failed to create purchase order", variant: "destructive" })
        }
      })
    } else {
      updatePo.mutate({ id: poId as number, data: values }, {
        onSuccess: (updatedData) => {
          toast({ title: "Purchase order updated successfully" })
          queryClient.setQueryData(getGetPurchaseOrderQueryKey(poId as number), updatedData)
          setLocation(`/purchase-orders/${poId}`)
        },
        onError: () => {
          toast({ title: "Failed to update purchase order", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createPo.isPending || updatePo.isPending

  if (!isNew && poLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/purchase-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Purchase Order" : `Edit Purchase Order PO-${po?.poNo}`}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Create a new purchase order." : "Update purchase order details."}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="poNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO No</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Details (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="deliveryLocation" render={({ field }) => (
                <FormItem><FormLabel>Delivery Location</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="termsOfDelivery" render={({ field }) => (
                <FormItem><FormLabel>Terms of Delivery</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="modeOfPayment" render={({ field }) => (
                <FormItem><FormLabel>Mode/Terms of Payment</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="md:col-span-3"><FormLabel>Notes</FormLabel><FormControl><Textarea className="resize-none" rows={3} {...field} /></FormControl></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Line Items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ sNo: fields.length + 1, description: "", discountPct: 0, qty: 1, rate: 0, per: "Nos", amount: 0 })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Row
              </Button>
            </CardHeader>
            <CardContent>
              {watchClientId ? (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Select from Purchase Item Master</div>
                  {!masterItems?.length ? (
                    <p className="text-sm text-muted-foreground">No saved items for this client yet — items you add below will be saved here automatically.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-md p-3">
                      {masterItems.map((entry) => {
                        const checked = selectedDescriptions.has(entry.description.trim().toLowerCase())
                        return (
                          <label key={entry.id} className="flex items-start gap-2 text-sm cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={() => toggleMasterItem(entry)} className="mt-0.5" />
                            <span>
                              {entry.description}
                              {entry.rate != null && <span className="text-muted-foreground"> — {formatCurrency(entry.rate)}</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">Pick a client above to see their saved purchase items.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                    <tr>
                      <th className="p-2 w-12 text-center">S.No</th>
                      <th className="p-2 min-w-[200px]">Description of Goods/Services</th>
                      <th className="p-2 w-24">Quantity</th>
                      <th className="p-2 w-32">Rate</th>
                      <th className="p-2 w-20">Per</th>
                      <th className="p-2 w-24">Discount %</th>
                      <th className="p-2 w-32 text-right">Amount</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.map((field, index) => (
                      <tr key={field.id} className="hover:bg-muted/20">
                        <td className="p-2 text-center">
                          <Input type="number" className="h-8 px-1 text-center" {...form.register(`items.${index}.sNo`, { valueAsNumber: true })} />
                        </td>
                        <td className="p-2">
                          <Input className="h-8" {...form.register(`items.${index}.description`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8" {...form.register(`items.${index}.qty`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8" {...form.register(`items.${index}.rate`)} />
                        </td>
                        <td className="p-2">
                          <Input className="h-8" {...form.register(`items.${index}.per`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8" {...form.register(`items.${index}.discountPct`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8 text-right font-mono" {...form.register(`items.${index}.amount`)} />
                        </td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {form.formState.errors.items?.root && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {form.formState.errors.items.root.message}
                </p>
              )}

              <div className="mt-8 flex flex-col items-end gap-4 text-sm">
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                  </div>

                  {interState ? (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span>IGST Rate (%):</span>
                        <Input
                          type="number"
                          className="w-16 h-7 px-1 text-right"
                          value={watchCgstRate + watchSgstRate}
                          onChange={(e) => {
                            const total = Number(e.target.value) || 0
                            form.setValue("cgstRate", total / 2)
                            form.setValue("sgstRate", total / 2)
                          }}
                        />
                      </div>
                      <span className="font-mono">{formatCurrency(totals.cgstAmount + totals.sgstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>CGST Rate (%):</span>
                          <Input type="number" className="w-16 h-7 px-1 text-right" {...form.register("cgstRate")} />
                        </div>
                        <span className="font-mono">{formatCurrency(totals.cgstAmount)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>SGST Rate (%):</span>
                          <Input type="number" className="w-16 h-7 px-1 text-right" {...form.register("sgstRate")} />
                        </div>
                        <span className="font-mono">{formatCurrency(totals.sgstAmount)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-muted-foreground border-t pt-2">
                    <span>Round off:</span>
                    <span className="font-mono">{totals.roundOff.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between font-bold text-lg border-t border-b py-2">
                    <span>Net Total:</span>
                    <span className="font-mono text-primary">{formatCurrency(totals.netTotal)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/purchase-orders">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving..." : "Save Purchase Order"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
