import { useEffect } from "react"
import { useLocation, useParams } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  useCreatePurchaseItemMaster,
  useUpdatePurchaseItemMaster,
  useGetPurchaseItemMaster,
  useListClients,
  getGetPurchaseItemMasterQueryKey,
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
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"

const formSchema = z.object({
  clientId: z.coerce.number().min(1, "Client is required"),
  description: z.string().min(1, "Description is required"),
  rate: z.coerce.number().min(0).optional(),
  per: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function PurchaseItemMasterForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const entryId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: clients } = useListClients()
  const { data: entry, isLoading } = useGetPurchaseItemMaster(entryId as number, {
    query: {
      enabled: !!entryId,
      queryKey: getGetPurchaseItemMasterQueryKey(entryId as number)
    }
  })

  const createEntry = useCreatePurchaseItemMaster()
  const updateEntry = useUpdatePurchaseItemMaster()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: 0,
      description: "",
      rate: undefined,
      per: "",
      discountPct: undefined,
    },
  })

  useEffect(() => {
    if (entry) {
      form.reset({
        clientId: entry.clientId,
        description: entry.description,
        rate: entry.rate ?? undefined,
        per: entry.per || "",
        discountPct: entry.discountPct ?? undefined,
      })
    }
  }, [entry, form])

  function onSubmit(values: FormValues) {
    if (isNew) {
      createEntry.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Item created successfully" })
          setLocation("/purchase-item-master")
        },
        onError: () => {
          toast({ title: "Failed to create item", variant: "destructive" })
        }
      })
    } else {
      updateEntry.mutate({ id: entryId as number, data: values }, {
        onSuccess: (updatedData) => {
          toast({ title: "Item updated successfully" })
          queryClient.setQueryData(getGetPurchaseItemMasterQueryKey(entryId as number), updatedData)
          setLocation("/purchase-item-master")
        },
        onError: () => {
          toast({ title: "Failed to update item", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createEntry.isPending || updateEntry.isPending

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/purchase-item-master">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Add Purchase Item" : "Edit Purchase Item"}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Add a reusable item for a client's purchase orders." : "Update this item."}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="63A 4P MCCB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="per"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Per</FormLabel>
                      <FormControl>
                        <Input placeholder="Nos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount %</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {isPending ? "Saving..." : "Save Item"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
