import { useEffect, useMemo } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  useCreateInvoice, 
  useUpdateInvoice, 
  useGetInvoice, 
  useListClients, 
  useGetNextInvoiceNumber,
  getGetInvoiceQueryKey
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

const itemSchema = z.object({
  sNo: z.number(),
  description: z.string().min(1, "Required"),
  hsnSac: z.string().optional(),
  qty: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  per: z.string().optional(),
  amount: z.coerce.number().min(0)
})

const formSchema = z.object({
  invoiceNo: z.coerce.number().min(1),
  date: z.string().min(1, "Date is required"),
  clientId: z.coerce.number().min(1, "Client is required"),
  workSite: z.string().optional(),
  deliveryNote: z.string().optional(),
  modeOfPayment: z.string().optional(),
  suppliersRef: z.string().optional(),
  othersRef: z.string().optional(),
  buyersOrderNo: z.string().optional(),
  buyersOrderDate: z.string().optional(),
  despatchDocNo: z.string().optional(),
  despatchDocDate: z.string().optional(),
  despatchedThrough: z.string().optional(),
  destination: z.string().optional(),
  termsOfDelivery: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  cgstRate: z.coerce.number(),
  sgstRate: z.coerce.number(),
})

type FormValues = z.infer<typeof formSchema>

export default function InvoiceForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const invoiceId = isNew ? null : Number(params.id)
  
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: clients, isLoading: clientsLoading } = useListClients()
  const { data: nextNumData } = useGetNextInvoiceNumber({ query: { enabled: isNew } })
  const { data: invoice, isLoading: invoiceLoading } = useGetInvoice(invoiceId as number, { 
    query: { 
      enabled: !!invoiceId,
      queryKey: getGetInvoiceQueryKey(invoiceId as number)
    } 
  })
  
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceNo: 1,
      date: new Date().toISOString().split('T')[0],
      clientId: 0,
      workSite: "",
      deliveryNote: "",
      modeOfPayment: "",
      suppliersRef: "",
      othersRef: "",
      buyersOrderNo: "",
      buyersOrderDate: "",
      despatchDocNo: "",
      despatchDocDate: "",
      despatchedThrough: "",
      destination: "",
      termsOfDelivery: "",
      cgstRate: 9,
      sgstRate: 9,
      items: [{ sNo: 1, description: "", hsnSac: "", qty: 1, rate: 0, per: "Nos", amount: 0 }]
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  // Watch for changes to calculate item amounts and totals
  const watchItems = useWatch({ control: form.control, name: "items" })
  const watchCgstRate = useWatch({ control: form.control, name: "cgstRate" }) || 0
  const watchSgstRate = useWatch({ control: form.control, name: "sgstRate" }) || 0

  // Auto-calculate item amounts if qty & rate are present
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name?.startsWith('items.') && (name.endsWith('.qty') || name.endsWith('.rate'))) {
        const match = name.match(/items\.(\d+)/)
        if (match) {
          const index = parseInt(match[1], 10)
          const item = value.items?.[index]
          if (item && item.qty && item.rate) {
            const amount = Number(item.qty) * Number(item.rate)
            form.setValue(`items.${index}.amount`, amount)
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
      form.setValue("invoiceNo", nextNumData.nextNumber)
    }
  }, [isNew, nextNumData, form])

  useEffect(() => {
    if (invoice) {
      form.reset({
        invoiceNo: invoice.invoiceNo,
        date: invoice.date.split('T')[0], // handle Date string
        clientId: invoice.clientId,
        workSite: invoice.workSite || "",
        deliveryNote: invoice.deliveryNote || "",
        modeOfPayment: invoice.modeOfPayment || "",
        suppliersRef: invoice.suppliersRef || "",
        othersRef: invoice.othersRef || "",
        buyersOrderNo: invoice.buyersOrderNo || "",
        buyersOrderDate: invoice.buyersOrderDate ? invoice.buyersOrderDate.split('T')[0] : "",
        despatchDocNo: invoice.despatchDocNo || "",
        despatchDocDate: invoice.despatchDocDate ? invoice.despatchDocDate.split('T')[0] : "",
        despatchedThrough: invoice.despatchedThrough || "",
        destination: invoice.destination || "",
        termsOfDelivery: invoice.termsOfDelivery || "",
        cgstRate: invoice.cgstRate,
        sgstRate: invoice.sgstRate,
        items: invoice.items.map(item => ({
          sNo: item.sNo,
          description: item.description,
          hsnSac: item.hsnSac || "",
          qty: item.qty || undefined,
          rate: item.rate || undefined,
          per: item.per || "",
          amount: item.amount
        }))
      })
    }
  }, [invoice, form])

  function onSubmit(values: FormValues) {
    if (isNew) {
      createInvoice.mutate({ data: values }, {
        onSuccess: (data) => {
          toast({ title: "Invoice created successfully" })
          setLocation(`/invoices/${data.id}`)
        },
        onError: () => {
          toast({ title: "Failed to create invoice", variant: "destructive" })
        }
      })
    } else {
      // API generated schema requires data wrapping update values, but partial structure
      updateInvoice.mutate({ id: invoiceId as number, data: values }, {
        onSuccess: (updatedData) => {
          toast({ title: "Invoice updated successfully" })
          queryClient.setQueryData(getGetInvoiceQueryKey(invoiceId as number), updatedData)
          setLocation(`/invoices/${invoiceId}`)
        },
        onError: () => {
          toast({ title: "Failed to update invoice", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createInvoice.isPending || updateInvoice.isPending

  if (!isNew && invoiceLoading) {
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
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Invoice" : `Edit Invoice INV-${invoice?.invoiceNo}`}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Create a new GST invoice." : "Update invoice details."}
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
                name="invoiceNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice No</FormLabel>
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
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField control={form.control} name="workSite" render={({ field }) => (
                <FormItem><FormLabel>Work Site</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="deliveryNote" render={({ field }) => (
                <FormItem><FormLabel>Delivery Note</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="modeOfPayment" render={({ field }) => (
                <FormItem><FormLabel>Mode/Terms of Payment</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="suppliersRef" render={({ field }) => (
                <FormItem><FormLabel>Supplier's Ref</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="buyersOrderNo" render={({ field }) => (
                <FormItem><FormLabel>Buyer's Order No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="buyersOrderDate" render={({ field }) => (
                <FormItem><FormLabel>Buyer's Order Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="despatchDocNo" render={({ field }) => (
                <FormItem><FormLabel>Despatch Doc No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="despatchedThrough" render={({ field }) => (
                <FormItem><FormLabel>Despatched through</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem><FormLabel>Destination</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
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
                onClick={() => append({ sNo: fields.length + 1, description: "", hsnSac: "", qty: 1, rate: 0, per: "Nos", amount: 0 })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Row
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                    <tr>
                      <th className="p-2 w-12 text-center">S.No</th>
                      <th className="p-2 min-w-[200px]">Description of Goods/Services</th>
                      <th className="p-2 w-24">HSN/SAC</th>
                      <th className="p-2 w-24">Quantity</th>
                      <th className="p-2 w-32">Rate</th>
                      <th className="p-2 w-20">Per</th>
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
                          <Input className="h-8" {...form.register(`items.${index}.hsnSac`)} />
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
              <Link href="/invoices">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
