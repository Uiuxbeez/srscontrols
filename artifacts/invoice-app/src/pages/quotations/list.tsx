import { useState } from "react"
import { Link } from "wouter"
import { useListQuotations } from "@/lib/quotation-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { Plus, Search, FileText } from "lucide-react"

export default function QuotationsList() {
  const [search, setSearch] = useState("")
  const { data: quotations, isLoading } = useListQuotations(search ? { search } : undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">Manage and track your quotations.</p>
        </div>
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by quotation no or client..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !quotations?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">No quotations found</p>
              <p className="text-sm text-muted-foreground">Create your first quotation to get started.</p>
            </div>
            <Button asChild>
              <Link href="/quotations/new">Create Quotation</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quotation No.</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-right font-medium">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotations.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/quotations/${q.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary">{q.quotationNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(q.date)}</td>
                    <td className="px-4 py-3 font-medium">{q.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{q.subject || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{q.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
