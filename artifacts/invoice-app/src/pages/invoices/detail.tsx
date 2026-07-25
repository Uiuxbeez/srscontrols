import { useGetInvoice, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate, numberToWords } from "@/lib/utils"
import { ArrowLeft, Edit, Printer, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/* ─── colour tokens (Zoho-style deep navy) ─── */
const COL = {
  header: "#1e3a8a",      // dark blue table header bg
  headerText: "#ffffff",
  accentBg: "#dbeafe",    // light blue totals highlight
  accentText: "#1e3a8a",
  border: "#d1d5db",      // light grey cell borders
  label: "#6b7280",       // grey label text
  value: "#111827",       // near-black value text
}

export default function InvoiceDetail() {
  const params = useParams()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id },
  })

  const deleteInvoice = useDeleteInvoice()

  const handleDelete = () => {
    deleteInvoice.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Invoice deleted successfully" })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        setLocation("/invoices")
      },
      onError: () => {
        toast({ title: "Failed to delete invoice", variant: "destructive" })
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[800px] w-full" />
      </div>
    )
  }

  if (!invoice) return <div>Invoice not found</div>

  /* ── derived values ── */
  const hsnGroups = Object.entries(
    invoice.items.reduce<Record<string, number>>((acc, item) => {
      const k = item.hsnSac || "—"
      acc[k] = (acc[k] || 0) + item.amount
      return acc
    }, {}),
  )

  const fillerRows = Math.max(0, 1 - invoice.items.length)

  return (
    <div className="space-y-6">
      {/* ── Toolbar (hidden on print) ── */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/invoices"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Invoice INV-{invoice.invoiceNo.toString().padStart(4, "0")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this invoice. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" asChild>
            <Link href={`/invoices/${id}/edit`}><Edit className="w-4 h-4 mr-2" /> Edit</Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          INVOICE DOCUMENT
      ════════════════════════════════════════ */}
      <div
        className="bg-white text-black mx-auto print:shadow-none print:m-0"
        style={{
          maxWidth: "210mm",
          border: `1px solid ${COL.border}`,
          borderRadius: "6px",
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          fontSize: "13px",
          color: COL.value,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Watermark */}
        <img
          src={`${import.meta.env.BASE_URL}srs-logo.webp`}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "55%",
            opacity: 0.055,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
          }}
        />

        {/* ── Content wrapper sits above the watermark ── */}
        <div style={{ position: "relative", zIndex: 1 }}>

        {/* ══ 1. HEADER: Company ↔ Logo + TAX INVOICE ══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 32px 24px", borderBottom: `1px solid ${COL.border}` }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px" }}>SRS CONTROLS</div>
            <div style={{ color: COL.label, lineHeight: 1.65, fontSize: "12px" }}>
              <div>Manufacturers of: Electric Control Panels</div>
              <div>New No. 97, Sanganoor Road, Ganapathy,</div>
              <div>Coimbatore – 641 006</div>
              <div>GSTIN/UIN: 33AKQPS9506E1ZH</div>
              <div>State: Tamil Nadu &nbsp;|&nbsp; Code: 33</div>
              <div>E-Mail: srscontrolscbe@gmail.com</div>
            </div>
          </div>
          {/* Logo + title + QR stacked on the right */}
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
            <img
              src={`${import.meta.env.BASE_URL}srs-logo.webp`}
              alt="SRS Controls logo"
              style={{ height: "64px", objectFit: "contain" }}
            />
            <div style={{ fontSize: "28px", fontWeight: 700, color: COL.header, letterSpacing: "1px", lineHeight: 1 }}>
              TAX INVOICE
            </div>
            {/* QR code linking to this invoice page (scannable → open → print as PDF) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", marginTop: "4px" }}>
              <QRCodeSVG
                value={typeof window !== "undefined" ? window.location.href : `invoices/${id}`}
                size={80}
                level="M"
                includeMargin={false}
                fgColor={COL.header}
              />
              <span style={{ fontSize: "9px", color: COL.label, letterSpacing: "0.03em" }}>Scan for soft copy</span>
            </div>
          </div>
        </div>

        {/* ══ 2. INVOICE META ROWS ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${COL.border}` }}>
          {/* Left column: key fields */}
          <div style={{ padding: "16px 32px", borderRight: `1px solid ${COL.border}` }}>
            {[
              ["Invoice No.", `INV-${invoice.invoiceNo.toString().padStart(4, "0")}`],
              ["Invoice Date", formatDate(invoice.date)],
              ["Mode / Terms of Payment", invoice.modeOfPayment || "—"],
              ["Supplier's Ref.", invoice.suppliersRef || "—"],
              ["Buyer's Order No.", invoice.buyersOrderNo || "—"],
              ["Buyer's Order Date", formatDate(invoice.buyersOrderDate)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "16px", marginBottom: "6px", alignItems: "baseline" }}>
                <span style={{ color: COL.label, minWidth: "160px", fontSize: "12px", flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
          {/* Right column: despatch fields */}
          <div style={{ padding: "16px 32px" }}>
            {[
              ["Delivery Note", invoice.deliveryNote || "—"],
              ["Despatch Doc. No.", invoice.despatchDocNo || "—"],
              ["Delivery Note Date", formatDate(invoice.despatchDocDate)],
              ["Despatched through", invoice.despatchedThrough || "—"],
              ["Destination", invoice.destination || "—"],
              ["Terms of Delivery", invoice.termsOfDelivery || "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "16px", marginBottom: "6px", alignItems: "baseline" }}>
                <span style={{ color: COL.label, minWidth: "160px", fontSize: "12px", flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 3. BILL TO ══ */}
        <div style={{ borderBottom: `1px solid ${COL.border}`, padding: "16px 32px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: COL.label, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Bill To
          </div>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{invoice.client.name}</div>
          <div style={{ color: COL.label, fontSize: "12px", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{invoice.client.address}</div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>
            <span style={{ color: COL.label }}>GSTIN/UIN: </span>{invoice.client.gstin || "—"}
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: COL.label }}>State: </span>Tamil Nadu &nbsp;|&nbsp; <span style={{ color: COL.label }}>Code: </span>33
          </div>
        </div>

        {/* ══ 4. LINE ITEMS TABLE ══ */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "37%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: COL.header, color: COL.headerText }}>
              <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>#</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, fontSize: "12px" }}>Item &amp; Descriptions</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>HSN/SAC</th>
              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Qty</th>
              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Rate</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>per</th>
              <th style={{ padding: "10px 16px 10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr
                key={item.id}
                style={{ borderBottom: `1px solid ${COL.border}`, backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa" }}
              >
                <td style={{ padding: "12px 8px", textAlign: "center", color: COL.label, fontSize: "12px", verticalAlign: "top" }}>{item.sNo}</td>
                <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 600 }}>{item.description}</div>
                  {item.hsnSac && (
                    <div style={{ color: COL.label, fontSize: "11px", marginTop: "2px" }}>HSN: {item.hsnSac}</div>
                  )}
                </td>
                <td style={{ padding: "12px 8px", textAlign: "center", color: COL.label, fontSize: "12px", verticalAlign: "top" }}>{item.hsnSac || "—"}</td>
                <td style={{ padding: "12px 8px", textAlign: "right", verticalAlign: "top" }}>{item.qty ?? "—"}</td>
                <td style={{ padding: "12px 8px", textAlign: "right", verticalAlign: "top" }}>{item.rate != null ? item.rate.toFixed(2) : "—"}</td>
                <td style={{ padding: "12px 8px", textAlign: "center", color: COL.label, fontSize: "12px", verticalAlign: "top" }}>{item.per}</td>
                <td style={{ padding: "12px 16px 12px 8px", textAlign: "right", fontWeight: 600, verticalAlign: "top" }}>{item.amount.toFixed(2)}</td>
              </tr>
            ))}
            {/* Filler rows */}
            {Array.from({ length: fillerRows }).map((_, i) => (
              <tr key={`f${i}`} style={{ borderBottom: `1px solid ${COL.border}`, height: "40px" }}>
                {[0,1,2,3,4,5,6].map(c => <td key={c} />)}
              </tr>
            ))}
            {/* Sub Total row */}
            <tr style={{ borderTop: `2px solid ${COL.border}`, borderBottom: `1px solid ${COL.border}` }}>
              <td colSpan={5} style={{ padding: "10px 8px" }} />
              <td style={{ padding: "10px 8px", textAlign: "right", color: COL.label, fontWeight: 600, fontSize: "12px" }}>Sub Total</td>
              <td style={{ padding: "10px 16px 10px 8px", textAlign: "right", fontWeight: 700 }}>
                {invoice.subtotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ══ 5. FOOTER: Declaration left | Totals box right ══ */}
        <div style={{ display: "flex", borderTop: `1px solid ${COL.border}` }}>
          {/* Left: Amount in words + declaration */}
          <div style={{ flex: 1, padding: "20px 32px", borderRight: `1px solid ${COL.border}` }}>
            <div style={{ fontSize: "11px", color: COL.label, marginBottom: "4px" }}>Amount Chargeable (in words)</div>
            <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "13px" }}>{invoice.amountInWords}</div>

            <div style={{ fontSize: "12px", color: COL.label, marginBottom: "12px" }}>
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>

            <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>Terms &amp; Conditions</div>
            <div style={{ fontSize: "12px", color: COL.label }}>
              Subject to Coimbatore Jurisdiction.
            </div>
          </div>

          {/* Right: Totals */}
          <div style={{ width: "260px", flexShrink: 0 }}>
            {/* CGST */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${COL.border}` }}>
              <span style={{ color: COL.label, fontSize: "12px" }}>Output CGST @ {invoice.cgstRate}%</span>
              <span style={{ fontWeight: 600 }}>{invoice.cgstAmount.toFixed(2)}</span>
            </div>
            {/* SGST */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${COL.border}` }}>
              <span style={{ color: COL.label, fontSize: "12px" }}>Output SGST @ {invoice.sgstRate}%</span>
              <span style={{ fontWeight: 600 }}>{invoice.sgstAmount.toFixed(2)}</span>
            </div>
            {/* Round Off */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${COL.border}` }}>
              <span style={{ color: COL.label, fontSize: "12px" }}>Round Off</span>
              <span style={{ fontWeight: 600 }}>{invoice.roundOff >= 0 ? "+" : ""}{invoice.roundOff.toFixed(2)}</span>
            </div>
            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", backgroundColor: COL.accentBg, borderBottom: `1px solid ${COL.border}` }}>
              <span style={{ fontWeight: 700, color: COL.accentText }}>Total</span>
              <span style={{ fontWeight: 700, color: COL.accentText, fontSize: "15px" }}>₹ {invoice.netTotal.toFixed(2)}</span>
            </div>
            {/* Balance Due */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", backgroundColor: COL.header }}>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: "13px" }}>Balance Due</span>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: "15px" }}>₹ {invoice.netTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ══ 6. HSN TAX SUMMARY ══ */}
        <div style={{ borderTop: `1px solid ${COL.border}`, padding: "0", display: "none" }}>
          <div style={{ padding: "8px 32px 4px", fontSize: "11px", fontWeight: 600, color: COL.label, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tax Analysis
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", borderTop: `1px solid ${COL.border}`, borderBottom: `1px solid ${COL.border}` }}>
                {["HSN/SAC", "Taxable Value", "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total Tax"].map((h, i) => (
                  <th key={h} style={{ padding: "7px 16px", textAlign: i === 0 ? "left" : "right", fontWeight: 600, color: COL.label }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hsnGroups.map(([hsn, taxable]) => (
                <tr key={hsn} style={{ borderBottom: `1px solid ${COL.border}` }}>
                  <td style={{ padding: "7px 16px" }}>{hsn}</td>
                  <td style={{ padding: "7px 16px", textAlign: "right" }}>{taxable.toFixed(2)}</td>
                  <td style={{ padding: "7px 16px", textAlign: "right" }}>{invoice.cgstRate}%</td>
                  <td style={{ padding: "7px 16px", textAlign: "right" }}>{((taxable * invoice.cgstRate) / 100).toFixed(2)}</td>
                  <td style={{ padding: "7px 16px", textAlign: "right" }}>{invoice.sgstRate}%</td>
                  <td style={{ padding: "7px 16px", textAlign: "right" }}>{((taxable * invoice.sgstRate) / 100).toFixed(2)}</td>
                  <td style={{ padding: "7px 16px", textAlign: "right", fontWeight: 600 }}>
                    {((taxable * (invoice.cgstRate + invoice.sgstRate)) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: "#f3f4f6", fontWeight: 700, borderTop: `1px solid ${COL.border}` }}>
                <td style={{ padding: "7px 16px" }}>Total</td>
                <td style={{ padding: "7px 16px", textAlign: "right" }}>{invoice.subtotal.toFixed(2)}</td>
                <td style={{ padding: "7px 16px", textAlign: "right" }} />
                <td style={{ padding: "7px 16px", textAlign: "right" }}>{invoice.cgstAmount.toFixed(2)}</td>
                <td style={{ padding: "7px 16px", textAlign: "right" }} />
                <td style={{ padding: "7px 16px", textAlign: "right" }}>{invoice.sgstAmount.toFixed(2)}</td>
                <td style={{ padding: "7px 16px", textAlign: "right" }}>{(invoice.cgstAmount + invoice.sgstAmount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══ 7. SIGNATURE ROW ══ */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 32px", borderTop: `1px solid ${COL.border}` }}>
          <div style={{ textAlign: "center", minWidth: "160px" }}>
            <div style={{ fontWeight: 700, marginBottom: "48px" }}>for SRS CONTROLS</div>
            <div style={{ borderTop: `1px solid ${COL.border}`, paddingTop: "6px", fontSize: "12px", color: COL.label }}>
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* ── close content wrapper ── */}
        </div>

      </div>
    </div>
  )
}
