import { useGetInvoice, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { ArrowLeft, Edit, Landmark, Mail, MapPin, Phone, Printer, ReceiptText, Trash2, UserRound } from "lucide-react"
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

/* ─── colour tokens from the green reference invoice ─── */
const COL = {
  header: "#006b2d",
  headerDark: "#004f22",
  headerText: "#ffffff",
  border: "#9bc8a8",
  softBorder: "#cfe3d4",
  label: "#0b4f24",
  value: "#111827",
  panelBg: "#f8fcf9",
}

/* ─── static company constants (not part of invoice data model) ─── */
const COMPANY = {
  name: "SRS CONTROLS",
  tagline: "Manufacturers of: Electric Control Panels",
  addressLines: ["New No. 97, Sanganoor Road, Ganapathy,", "Coimbatore – 641 006"],
  gstin: "33AKQPS9506E1ZH",
  stateCode: "33",
  email: "srscontrolscbe@gmail.com",
  phone: "+91 98765 43210",
}

const BANK_DETAILS = {
  bankName: "KARUR VYSYA BANK",
  accountName: "SRS CONTROLS",
  accountNo: "1721223000000070",
  branch: "Thudiyalur",
  ifsc: "KVBL0001721",
}

const TERMS = [
  "Goods once sold cannot be taken back or exchanged under any circumstances.",
  "Our risk & responsibility of the goods ceases as soon as materials are despatched from our godown.",
  "All disputes are subject to Coimbatore jurisdiction only.",
]

const formatAmount = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const totalQty = invoice.items.reduce((sum, i) => sum + (i.qty ?? 0), 0)

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
          border: `1.5px solid ${COL.header}`,
          borderRadius: "8px",
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
            opacity: 0.05,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ══ 1. HEADER: reference-style title, company block, and QR ══ */}
          <div style={{ position: "relative", padding: "16px 32px 20px", borderBottom: `1px solid ${COL.border}` }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", paddingTop: "0px" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", minWidth: 0 }}>
              <img
                src={`${import.meta.env.BASE_URL}srs-logo.webp`}
                alt="SRS Controls logo"
                style={{ height: "78px", width: "78px", objectFit: "contain", marginTop: "2px" }}
              />
              <div>
                <div style={{ fontWeight: 900, fontSize: "16px", color: COL.header, lineHeight: 1, marginBottom: "10px" }}>{COMPANY.name}</div>
                <div style={{ color: COL.value, lineHeight: 1.65, fontSize: "12.5px", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <MapPin size={14} color={COL.header} style={{ marginTop: "2px", flexShrink: 0 }} />
                    <span>{COMPANY.tagline}, {COMPANY.addressLines.join(" ")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Phone size={13} color={COL.header} /> {COMPANY.phone}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Mail size={13} color={COL.header} /> {COMPANY.email}
                  </div>
                  <div style={{ marginTop: "3px", fontWeight: 800 }}>
                    GST No.: {COMPANY.gstin} &nbsp;|&nbsp; State Code: {COMPANY.stateCode}
                  </div>
                </div>
              </div>
            </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <div style={{ alignSelf: "flex-end", color: COL.value, fontSize: "12px", fontWeight: 800 }}>
                  (ORIGINAL FOR RECIPIENT)
                </div>
                <div style={{ color: COL.header, fontSize: "13px", fontWeight: 800 }}>e-Invoice</div>
                <div style={{ border: `1.5px solid ${COL.header}`, padding: "7px", backgroundColor: "#fff" }}>
                  <QRCodeSVG
                    value={typeof window !== "undefined" ? window.location.href : `invoices/${id}`}
                    size={94}
                    level="M"
                    includeMargin={false}
                    fgColor="#111827"
                  />
                </div>
              </div>
            </div>


          </div>

          {/* 2. BILLING + REFERENCE DETAILS */}
          <div style={{ padding: "10px 10px 0px" }}>
            <div style={{ border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden", backgroundColor: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", color: COL.label, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", backgroundColor: COL.panelBg, borderBottom: `1px solid ${COL.softBorder}` }}>
                <UserRound size={16} /> Bill To
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.35fr", gap: "16px", padding: "12px 14px 14px" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "14px", marginBottom: "8px" }}>{invoice.client.name}</div>
                  <div style={{ fontSize: "12.5px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{invoice.client.address}</div>
                  {invoice.client.phone && <div style={{ fontSize: "12.5px", lineHeight: 1.6 }}>M.{invoice.client.phone}</div>}
                  <div style={{ fontSize: "12.5px", lineHeight: 1.6 }}>Tamil Nadu, Code : 33</div>
                  <div style={{ fontSize: "12.5px", lineHeight: 1.6, fontWeight: 700 }}>GST No. : {invoice.client.gstin || "-"}</div>
                  <div style={{ marginTop: "12px", padding: "9px 11px", backgroundColor: COL.panelBg, borderLeft: `3px solid ${COL.header}`, color: COL.label, fontSize: "12px", lineHeight: 1.45, fontWeight: 700 }}>
                    Welcome to SRS Controls. Thank you for trusting us with your control panel requirements.
                  </div>
                </div>
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${COL.border}`, borderRadius: "4px 4px 0 0", overflow: "hidden", backgroundColor: "#fff" }}>
                    {[
                      ["Invoice No.", `INV-${invoice.invoiceNo.toString().padStart(4, "0")}`],
                      ["Delivery Note", invoice.deliveryNote || "-"],
                      ["Invoice Date", formatDate(invoice.date)],
                      ["Despatch Doc. No.", invoice.despatchDocNo || "-"],
                      ["Mode / Terms of Payment", invoice.modeOfPayment || "-"],
                      ["Delivery Note Date", formatDate(invoice.despatchDocDate)],
                      ["Supplier's Ref.", invoice.suppliersRef || "-"],
                      ["Despatched through", invoice.despatchedThrough || "-"],
                      ["Buyer's Order No.", invoice.buyersOrderNo || "-"],
                      ["Destination", invoice.destination || "-"],
                    ].map(([label, value], index) => (
                      <div key={label} style={{ display: "grid", gridTemplateColumns: "50% 1fr", minHeight: "28px", borderRight: index % 2 === 0 ? `1px solid ${COL.softBorder}` : "none", borderBottom: index < 8 ? `1px solid ${COL.softBorder}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", padding: "3px 7px", color: COL.label, fontSize: "11.5px", fontWeight: 700, backgroundColor: COL.panelBg }}>
                          {label}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", padding: "3px 7px", fontSize: "11.5px", fontWeight: 700 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${COL.border}`, borderTop: "none", borderRadius: "0 0 4px 4px", overflow: "hidden", backgroundColor: "#fff" }}>
                    {[
                      ["Buyer's Order Date", formatDate(invoice.buyersOrderDate)],
                      ["Terms of Delivery", invoice.termsOfDelivery || "-"],
                    ].map(([label, value], index) => (
                      <div key={label} style={{ minHeight: "38px", padding: "5px 8px", borderRight: index === 0 ? `1px solid ${COL.softBorder}` : "none" }}>
                        <div style={{ color: COL.label, fontSize: "11.5px", fontWeight: 800, marginBottom: "3px" }}>{label}</div>
                        <div style={{ fontSize: "11.5px", fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ 3. LINE ITEMS TABLE ══ */}
          <table style={{ width: "calc(100% - 20px)", margin: "8px 10px 0", borderCollapse: "separate", borderSpacing: 0, border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: COL.header, color: COL.headerText }}>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>S.No.</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Description</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>HSN</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>GST%</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Quantity</th>
                <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Rate</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Disc%</th>
                <th style={{ padding: "10px 10px 10px 8px", textAlign: "right", fontWeight: 800, fontSize: "12px" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ backgroundColor: "#fff" }}
                >
                  <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "12px", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.sNo}</td>
                  <td style={{ padding: "10px 12px", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>
                    <div style={{ fontWeight: 500 }}>{item.description}</div>
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "12px", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.hsnSac || "—"}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "12px", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{invoice.cgstRate + invoice.sgstRate}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.qty ?? "—"} {item.per || ""}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.rate != null ? formatAmount(item.rate) : "—"}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center", verticalAlign: "top", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>—</td>
                  <td style={{ padding: "10px 10px 10px 8px", textAlign: "right", fontWeight: 700, verticalAlign: "top", borderBottom: `1px solid ${COL.softBorder}` }}>{formatAmount(item.amount)}</td>
                </tr>
              ))}
              {Array.from({ length: fillerRows }).map((_, i) => (
                <tr key={`f${i}`} style={{ borderBottom: `1px solid ${COL.border}`, height: "40px" }}>
                  {[0,1,2,3,4,5,6,7].map(c => <td key={c} />)}
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ padding: "11px 12px", fontSize: "12px", color: COL.label, fontWeight: 800 }}>
                  Total Quantity: {totalQty} Nos
                </td>
                <td colSpan={3} style={{ padding: "11px 8px" }} />
                <td style={{ padding: "11px 8px", textAlign: "right", color: COL.value, fontWeight: 700, fontSize: "12px" }}>Sub Total</td>
                <td style={{ padding: "11px 10px 11px 8px", textAlign: "right", fontWeight: 800 }}>
                  {formatAmount(invoice.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ══ 4. FOOTER: Amount in words left | Totals box right (green→blue grand total bar) ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.95fr", margin: "10px 10px 0", border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ padding: "7px 7px", borderRight: `1px solid ${COL.softBorder}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "145px 1fr", alignItems: "center", fontSize: "12px", color: COL.label, fontWeight: 800, paddingBottom: "10px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span>Total Quantity</span>
                <span>: &nbsp; {totalQty} Nos</span>
              </div>
              <div style={{ paddingTop: "12px" }}>
                <div style={{ fontSize: "12px", color: COL.label, fontWeight: 800, marginBottom: "6px" }}>Amount (in words)</div>
                <div style={{ fontWeight: 800, fontSize: "14px", lineHeight: 1.35 }}>INR {invoice.amountInWords}</div>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Sub Total</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(invoice.subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Output CGST Taxes</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(invoice.cgstAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Output SGST Taxes</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(invoice.sgstAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Round Off</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(invoice.roundOff)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 7px", backgroundColor: COL.header, color: "#fff" }}>
                <span style={{ fontWeight: 900, fontSize: "14px" }}>GRAND TOTAL</span>
                <span style={{ fontWeight: 900, fontSize: "16px" }}>₹ {formatAmount(invoice.netTotal)}</span>
              </div>
            </div>
          </div>

          {/* ══ 5. HSN TAX SUMMARY ══ */}
          <div style={{ borderTop: `1px solid ${COL.border}`, padding: "0", display: "none" }}>
            <div style={{ padding: "8px 32px 4px", fontSize: "11px", fontWeight: 600, color: COL.label, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tax Analysis
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6", borderTop: `1px solid ${COL.border}`, borderBottom: `1px solid ${COL.border}` }}>
                  {["HSN/SAC", "Taxable Value", "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total Tax"].map((h, i) => (
                    <th key={h} style={{ padding: "7px 14px", textAlign: i === 0 ? "left" : "right", fontWeight: 600, color: COL.label }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hsnGroups.map(([hsn, taxable]) => (
                  <tr key={hsn} style={{ borderBottom: `1px solid ${COL.border}` }}>
                    <td style={{ padding: "7px 14px" }}>{hsn}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>{taxable.toFixed(2)}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>{invoice.cgstRate}%</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>{((taxable * invoice.cgstRate) / 100).toFixed(2)}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>{invoice.sgstRate}%</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>{((taxable * invoice.sgstRate) / 100).toFixed(2)}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right", fontWeight: 600 }}>
                      {((taxable * (invoice.cgstRate + invoice.sgstRate)) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#f3f4f6", fontWeight: 700, borderTop: `1px solid ${COL.border}` }}>
                  <td style={{ padding: "7px 14px" }}>Total</td>
                  <td style={{ padding: "7px 14px", textAlign: "right" }}>{invoice.subtotal.toFixed(2)}</td>
                  <td style={{ padding: "7px 14px", textAlign: "right" }} />
                  <td style={{ padding: "7px 14px", textAlign: "right" }}>{invoice.cgstAmount.toFixed(2)}</td>
                  <td style={{ padding: "7px 14px", textAlign: "right" }} />
                  <td style={{ padding: "7px 14px", textAlign: "right" }}>{invoice.sgstAmount.toFixed(2)}</td>
                  <td style={{ padding: "7px 14px", textAlign: "right" }}>{(invoice.cgstAmount + invoice.sgstAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══ 6. TERMS & CONDITIONS + BANK DETAILS ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.9fr", gap: "10px", margin: "10px 10px 0" }}>
            <div style={{ padding: "7px 7px", border: `1px solid ${COL.border}`, borderRadius: "4px", minHeight: "144px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 900, fontSize: "13px", marginBottom: "8px", color: COL.label, textTransform: "uppercase" }}>
                <ReceiptText size={17} /> Terms &amp; Conditions
              </div>
              <ol style={{ paddingLeft: "14px", margin: 0, color: COL.value, fontSize: "10.5px", lineHeight: 1.45 }}>
                {TERMS.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>
            <div style={{ padding: "7px 7px", border: `1px solid ${COL.border}`, borderRadius: "4px", minHeight: "144px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 900, fontSize: "13px", marginBottom: "10px", color: COL.label, textTransform: "uppercase" }}>
                <Landmark size={14} /> Company&apos;s Bank Details
              </div>
              <div style={{ fontSize: "12px", lineHeight: 1.9, fontWeight: 600 }}>
                {[
                  ["Bank Name", BANK_DETAILS.bankName],
                  ["Account Name", BANK_DETAILS.accountName],
                  ["A/c No.", BANK_DETAILS.accountNo],
                  ["Branch", BANK_DETAILS.branch],
                  ["IFS Code", BANK_DETAILS.ifsc],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: "10px" }}>
                    <span>{label}</span>
                    <span>: &nbsp; {value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 7. CUSTOMER NOTE + SIGNATURE ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.35fr", marginTop: "14px", borderTop: `1px solid ${COL.softBorder}` }}>
            <div style={{ minHeight: "82px", padding: "5px 7px", fontSize: "12px", fontWeight: 700, color: COL.label, borderRight: `1px solid ${COL.softBorder}`, backgroundColor: COL.panelBg }}>
              <div style={{ fontWeight: 900, textTransform: "uppercase", marginBottom: "8px" }}>To the Bill To Team</div>
              <div style={{ lineHeight: 1.55 }}>
                Welcome to SRS Controls. We appreciate your business and look forward to serving you again.
              </div>
            </div>
            <div style={{ minHeight: "82px", padding: "5px 7px", textAlign: "center", fontSize: "11px", fontWeight: 800, color: COL.label, borderRight: `1px solid ${COL.softBorder}` }}>
              Receiver&apos;s Signature
              <div style={{ borderTop: `1px dashed ${COL.border}`, margin: "42px auto 0", width: "75%" }} />
            </div>
            <div style={{ minHeight: "82px", padding: "3px 7px", textAlign: "center" }}>
              <div style={{ fontWeight: 900, marginBottom: "38px", color: COL.label }}>For {COMPANY.name}</div>
              <div style={{ fontSize: "12px", color: COL.label, fontWeight: 800 }}>
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
