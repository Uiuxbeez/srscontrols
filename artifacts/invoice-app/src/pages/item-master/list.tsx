import { useState } from "react"
import { Link } from "wouter"
import {
  useListCategories, useListSubCategories, useListItems,
  useDeleteCategory, useDeleteSubCategory, useDeleteItem,
  getListCategoriesQueryKey, getListSubCategoriesQueryKey, getListItemsQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Trash2, FileUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export default function ItemMasterList() {
  const { data: categories, isLoading } = useListCategories()
  const { data: subCategories } = useListSubCategories()
  const { data: items } = useListItems()
  const deleteCategory = useDeleteCategory()
  const deleteSubCategory = useDeleteSubCategory()
  const deleteItem = useDeleteItem()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({})

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListSubCategoriesQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListItemsQueryKey() })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Item Master</h1>
          <p className="text-muted-foreground">Category → Sub-Category → Item catalog.</p>
        </div>
        <Link href="/item-master/import" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
          <FileUp className="mr-2 w-4 h-4" /> Import from PDF
        </Link>
      </div>

      {!categories?.length ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No categories yet. Import a supplier catalog PDF to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const catSubCategories = (subCategories ?? []).filter((s) => s.categoryId === category.id)
            const isOpen = openCategories[category.id] ?? true
            return (
              <Card key={category.id}>
                <Collapsible open={isOpen} onOpenChange={(v) => setOpenCategories((prev) => ({ ...prev, [category.id]: v }))}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CollapsibleTrigger asChild>
                      <button type="button" className="flex items-center gap-2 text-left">
                        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                        <CardTitle>{category.name}</CardTitle>
                      </button>
                    </CollapsibleTrigger>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{category.name}" and all of its sub-categories and items. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteCategory.mutate({ id: category.id }, {
                              onSuccess: () => { toast({ title: "Category deleted" }); invalidateAll() },
                              onError: () => toast({ title: "Failed to delete category", variant: "destructive" }),
                            })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {catSubCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sub-categories yet.</p>
                      ) : (
                        catSubCategories.map((sub) => {
                          const subItems = (items ?? []).filter((i) => i.subCategoryId === sub.id)
                          return (
                            <div key={sub.id} className="border rounded-md">
                              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                <span className="font-medium text-sm">{sub.name}</span>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete sub-category?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete "{sub.name}" and all of its items. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteSubCategory.mutate({ id: sub.id }, {
                                          onSuccess: () => { toast({ title: "Sub-category deleted" }); invalidateAll() },
                                          onError: () => toast({ title: "Failed to delete sub-category", variant: "destructive" }),
                                        })}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                              {subItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-4">No items yet.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Cat No.</TableHead>
                                      <TableHead className="text-right">Price</TableHead>
                                      <TableHead className="text-right">Pack Qty</TableHead>
                                      <TableHead>Specifications</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {subItems.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{item.catNo || "—"}</TableCell>
                                        <TableCell className="text-right font-mono">{fmt(item.price)}</TableCell>
                                        <TableCell className="text-right">{item.packQty ?? "—"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{item.specifications || "—"}</TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                            onClick={() => deleteItem.mutate({ id: item.id }, {
                                              onSuccess: () => { toast({ title: "Item deleted" }); invalidateAll() },
                                              onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
                                            })}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
