import { useEffect, useMemo } from "react"
import { useLocation, useParams, Link } from "wouter"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useListClients } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useCreateQuotation,
  useUpdateQuotation,
  useGetQuotation,
  useGetNextQuotationNumber,
  quotationKeys,
} from "@/lib/quotation-api"
import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const itemSchema = z.object({
  sNo: z.number().int().min(1),
  description: z.string().min(1, "Required"),
  qty: z.coerce.number().nullable().optional(),
  rate: z.coerce.number().nullable().optional(),
  amount: z.coerce.number().min(0),
})

const formSchema = z.object({
  quotationNo: z.string().min(1, "Required"),
  date: z.string().min(1, "Date is required"),
  clientId: z.coerce.number().min(1, "Client is required"),
  subject: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
  termsAdvance: z.string().optional(),
  termsDelivery: z.string().optional(),
  termsTransport: z.string().optional(),
  termsTax: z.string().optional(),
  termsValidity: z.string().optional(),
  termsWarranty: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
})

type FormValues = z.infer<typeof formSchema>

const DEFAULT_TERMS = {
  termsAdvance: "50% advance along with Purchase Order, balance against supply",
  termsDelivery: "15 – 25 days from date of PO with advance",
  termsTransport: "Extra",
  termsTax: "GST 18% extra",
  termsValidity: "10 days",
  termsWarranty: "12 months from date of delivery",
}

export default function QuotationForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const quotationId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: clients } = useListClients()
  const { data: nextNumData } = useGetNextQuotationNumber()
  const { data: quotation, isLoading: quotationLoading } = useGetQuotation(quotationId as number)

  const create = useCreateQuotation()
  const update = useUpdateQuotation()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quotationNo: "",
      date: new Date().toISOString().split("T")[0],
      clientId: 0,
      subject: "",
      discountPct: 0,
      gstRate: 18,
      ...DEFAULT_TERMS,
      notes: "",
      items: [{ sNo: 1, description: "", qty: 1, rate: 0, amount: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchItems = useWatch({ control: form.control, name: "items" })
  const watchDiscount = useWatch({ control: form.control, name: "discountPct" }) || 0
  const watchGst = useWatch({ control: form.control, name: "gstRate" }) || 0

  /* Auto-calc amount = qty × rate */
  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name?.startsWith("items.") && (name.endsWith(".qty") || name.endsWith(".rate"))) {
        const match = name.match(/items\.(\d+)/)
        if (match) {
          const idx = parseInt(match[1]!, 10)
          const item = value.items?.[idx]
          if (item && item.qty != null && item.rate != null) {
            form.setValue(`items.${idx}.amount`, Number(item.qty) * Number(item.rate))
          }
        }
      }
    })
    return () => sub.unsubscribe()
  }, [form])

  const totals = useMemo(() => {
    const subtotal = watchItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const discountAmount = (subtotal * Number(watchDiscount)) / 100
    const afterDiscount = subtotal - discountAmount
    const gstAmount = (afterDiscount * Number(watchGst)) / 100
    const gross = afterDiscount + gstAmount
    const grandTotal = Math.round(gross)
    return { subtotal, discountAmount, afterDiscount, gstAmount, grandTotal, roundOff: grandTotal - gross }
  }, [watchItems, watchDiscount, watchGst])

  useEffect(() => {
    if (isNew && nextNumData) form.setValue("quotationNo", nextNumData.nextNumber)
  }, [isNew, nextNumData, form])

  useEffect(() => {
    if (quotation) {
      form.reset({
        quotationNo: quotation.quotationNo,
        date: quotation.date.split("T")[0],
        clientId: quotation.clientId,
        subject: quotation.subject || "",
        discountPct: quotation.discountPct,
        gstRate: quotation.gstRate,
        termsAdvance: quotation.termsAdvance || DEFAULT_TERMS.termsAdvance,
        termsDelivery: quotation.termsDelivery || DEFAULT_TERMS.termsDelivery,
        termsTransport: quotation.termsTransport || DEFAULT_TERMS.termsTransport,
        termsTax: quotation.termsTax || DEFAULT_TERMS.termsTax,
        termsValidity: quotation.termsValidity || DEFAULT_TERMS.termsValidity,
        termsWarranty: quotation.termsWarranty || DEFAULT_TERMS.termsWarranty,
        notes: quotation.notes || "",
        items: quotation.items.map((i) => ({
          sNo: i.sNo,
          description: i.description,
          qty: i.qty,
          rate: i.rate,
          amount: i.amount,
        })),
      })
    }
  }, [quotation, form])

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      items: values.items.map((i) => ({
        ...i,
        qty: i.qty ?? null,
        rate: i.rate ?? null,
      })),
    }

    if (isNew) {
      create.mutate(payload, {
        onSuccess: (data) => {
          toast({ title: "Quotation created successfully" })
          setLocation(`/quotations/${data.id}`)
        },
        onError: () => toast({ title: "Failed to create quotation", variant: "destructive" }),
      })
    } else {
      update.mutate({ id: quotationId as number, data: payload }, {
        onSuccess: (data) => {
          toast({ title: "Quotation updated successfully" })
          queryClient.setQueryData(quotationKeys.detail(quotationId as number), data)
          setLocation(`/quotations/${quotationId}`)
        },
        onError: () => toast({ title: "Failed to update quotation", variant: "destructive" }),
      })
    }
  }

  const isPending = create.isPending || update.isPending

  if (!isNew && quotationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/quotations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Quotation" : `Edit Quotation ${quotation?.quotationNo}`}
          </h1>
          <p className="text-muted-foreground">{isNew ? "Create a new quotation." : "Update quotation details."}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Details */}
          <Card>
            <CardHeader><CardTitle>Basic Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="quotationNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation No.</FormLabel>
                  <FormControl><Input placeholder="R-1/26-27" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : undefined}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Subject</FormLabel>
                  <FormControl><Input placeholder="Quotation for supply of electrical panels..." {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm"
                onClick={() => append({ sNo: fields.length + 1, description: "", qty: 1, rate: 0, amount: 0 })}>
                <Plus className="w-4 h-4 mr-1" /> Add Row
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-y">
                    <tr>
                      <th className="p-2 w-12 text-center">S.No</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 w-28">Qty</th>
                      <th className="p-2 w-36">Rate (₹)</th>
                      <th className="p-2 w-36 text-right">Amount (₹)</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.map((field, index) => (
                      <tr key={field.id} className="hover:bg-muted/20">
                        <td className="p-2 text-center">
                          <Input type="number" className="h-8 px-1 text-center"
                            {...form.register(`items.${index}.sNo`, { valueAsNumber: true })} />
                        </td>
                        <td className="p-2">
                          <Textarea className="min-h-[36px] resize-none text-sm"
                            {...form.register(`items.${index}.description`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.001" className="h-8"
                            {...form.register(`items.${index}.qty`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8"
                            {...form.register(`items.${index}.rate`)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="h-8 text-right font-mono"
                            {...form.register(`items.${index}.amount`)} />
                        </td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-6 flex flex-col items-end gap-2 text-sm">
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono font-medium">{fmt(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Discount</span>
                      <Input type="number" className="w-16 h-7 px-1 text-right"
                        {...form.register("discountPct")} />
                      <span className="text-muted-foreground">%</span>
                    </div>
                    <span className="font-mono text-orange-600">- {fmt(totals.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">After Discount</span>
                    <span className="font-mono font-medium">{fmt(totals.afterDiscount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">GST</span>
                      <Input type="number" className="w-16 h-7 px-1 text-right"
                        {...form.register("gstRate")} />
                      <span className="text-muted-foreground">%</span>
                    </div>
                    <span className="font-mono">{fmt(totals.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Round off</span>
                    <span className="font-mono">{totals.roundOff.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-b py-2">
                    <span>Grand Total</span>
                    <span className="font-mono text-primary">{fmt(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms */}
          <Card>
            <CardHeader><CardTitle>Terms &amp; Conditions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["termsAdvance", "termsDelivery", "termsTransport", "termsTax", "termsValidity", "termsWarranty"] as const).map((f) => (
                <FormField key={f} control={form.control} name={f} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{f.replace("terms", "")}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              ))}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl><Textarea className="resize-none" rows={3} {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/quotations">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving..." : "Save Quotation"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
