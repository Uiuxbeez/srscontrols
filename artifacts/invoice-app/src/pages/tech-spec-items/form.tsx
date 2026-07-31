import { useEffect } from "react"
import { useLocation, useParams } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useCreateTechSpecItem, useUpdateTechSpecItem, useGetTechSpecItem, getGetTechSpecItemQueryKey } from "@workspace/api-client-react"
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
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save } from "lucide-react"
import { Link } from "wouter"
import { Skeleton } from "@/components/ui/skeleton"

const formSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  defaultSpec: z.string().min(1, "Default spec is required"),
})

type FormValues = z.infer<typeof formSchema>

export default function TechSpecItemForm() {
  const [, setLocation] = useLocation()
  const params = useParams()
  const isNew = !params.id || params.id === "new"
  const itemId = isNew ? null : Number(params.id)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: techSpecItem, isLoading } = useGetTechSpecItem(itemId as number, {
    query: {
      enabled: !!itemId,
      queryKey: getGetTechSpecItemQueryKey(itemId as number)
    }
  })

  const createTechSpecItem = useCreateTechSpecItem()
  const updateTechSpecItem = useUpdateTechSpecItem()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemName: "",
      defaultSpec: "",
    },
  })

  useEffect(() => {
    if (techSpecItem) {
      form.reset({
        itemName: techSpecItem.itemName,
        defaultSpec: techSpecItem.defaultSpec,
      })
    }
  }, [techSpecItem, form])

  function onSubmit(values: FormValues) {
    if (isNew) {
      createTechSpecItem.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Tech spec item created successfully" })
          setLocation("/tech-spec-items")
        },
        onError: () => {
          toast({ title: "Failed to create tech spec item", variant: "destructive" })
        }
      })
    } else {
      updateTechSpecItem.mutate({ id: itemId as number, data: values }, {
        onSuccess: (updatedData) => {
          toast({ title: "Tech spec item updated successfully" })
          queryClient.setQueryData(getGetTechSpecItemQueryKey(itemId as number), updatedData)
          setLocation("/tech-spec-items")
        },
        onError: () => {
          toast({ title: "Failed to update tech spec item", variant: "destructive" })
        }
      })
    }
  }

  const isPending = createTechSpecItem.isPending || updateTechSpecItem.isPending

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
          <Link href="/tech-spec-items">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Add Tech Spec Item" : "Edit Tech Spec Item"}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? "Add a new item / default spec pair." : "Update the item / default spec pair."}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="SHEET" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultSpec"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Spec</FormLabel>
                    <FormControl>
                      <Input placeholder="Tata Sheet usage only" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
