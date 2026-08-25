import { useEffect } from "react"
import { useLocation, useParams } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useCreateSupplier, useUpdateSupplier, useGetSupplier, getGetSupplierQueryKey } from "@workspace/api-client-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"

const formSchema = z.object({
  name: z.string().min(1, "Company Name is required"),
  address: z.string().min(1, "Address is required"),
  gstin: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
})

type FormValues = z.infer<typeof formSchema>

export default function SupplierForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const supplierId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: supplier, isLoading } = useGetSupplier(supplierId as number, {
    query: {
      enabled: !!supplierId,
      queryKey: getGetSupplierQueryKey(supplierId as number)
    }
  })

  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      gstin: "",
      phone: "",
      email: "",
    },
  })

  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name,
        address: supplier.address,
        gstin: supplier.gstin || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
      })
    }
  }, [supplier, form])

  function onSubmit(values: FormValues) {
    if (isNew) {
      createSupplier.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Supplier created successfully" })
          setLocation("/suppliers")
        },
        onError: () => {
          toast({ title: "Failed to create supplier", variant: "destructive" })
        }
      })
    } else {
      updateSupplier.mutate({ id: supplierId as number, data: values }, {
        onSuccess: (updatedData) => {
          toast({ title: "Supplier updated successfully" })
          queryClient.setQueryData(getGetSupplierQueryKey(supplierId as number), updatedData)
          setLocation("/suppliers")
        },
        onError: () => {
          toast({ title: "Failed to update supplier", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createSupplier.isPending || updateSupplier.isPending

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
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Add New Supplier" : "Edit Supplier"}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Enter supplier details below." : "Update supplier information."}
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
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Supplies Pvt Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Industrial Estate..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="29XXXXX0000X1Z5" className="font-mono" {...field} />
                    </FormControl>
                    <FormDescription>Optional, required for GST purchase documents.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+91..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@acme.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {isPending ? "Saving..." : "Save Supplier"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
