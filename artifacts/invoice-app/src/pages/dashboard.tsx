import { useGetInvoiceStats, useGetRecentInvoices } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight, IndianRupee, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetInvoiceStats()
  const { data: recentInvoices, isLoading: recentLoading } = useGetRecentInvoices()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your invoicing activity.</p>
        </div>
        <Link href="/invoices/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
          <Plus className="mr-2 w-4 h-4" /> New Invoice
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.thisMonthRevenue || 0)}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  {stats && stats.lastMonthRevenue > 0 && (
                    <span className={`mr-1 flex items-center ${stats.thisMonthRevenue >= stats.lastMonthRevenue ? 'text-emerald-600' : 'text-destructive'}`}>
                      {stats.thisMonthRevenue >= stats.lastMonthRevenue ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    </span>
                  )}
                  vs last month ({formatCurrency(stats?.lastMonthRevenue || 0)})
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices Issued</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalInvoices || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.thisMonthCount || 0} this month</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Invoices</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Your 5 most recently created invoices.</p>
          </div>
          <Link href="/invoices" className="text-sm text-primary hover:underline font-medium">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !recentInvoices?.length ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/30">
              No invoices found. Create your first invoice to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline text-primary">
                        INV-{inv.invoiceNo.toString().padStart(4, '0')}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(inv.netTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
