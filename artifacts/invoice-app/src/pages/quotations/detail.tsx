import { useParams, useLocation, Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { useGetQuotation, useDeleteQuotation, quotationKeys } from "@/lib/quotation-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Edit, Printer, Trash2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/* ─── Colour tokens (orange theme) ─── */
const C = {
  orange: "#ea580c",
  orangeLight: "#fff7ed",
  orangeBorder: "#fed7aa",
  header: "#ea580c",
  headerText: "#ffffff",
  border: "#e5e7eb",
  label: "#6b7280",
  value: "#111827",
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) }
  catch { return d }
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export default function QuotationDetail() {
  const params = useParams()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: quotation, isLoading } = useGetQuotation(id)
  const deleteQuotation = useDeleteQuotation()

  const handleDelete = () => {
    deleteQuotation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Quotation deleted" })
        queryClient.invalidateQueries({ queryKey: quotationKeys.all })
        setLocation("/quotations")
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    })
  }

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[900px] w-full" />
    </div>
  )

  if (!quotation) return <div className="p-8 text-center text-muted-foreground">Quotation not found.</div>

  const fillerRows = Math.max(0, 5 - quotation.items.length)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/quotations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Quotation {quotation.quotationNo}</h1>
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
                <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete this quotation. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" asChild>
            <Link href={`/quotations/${id}/edit`}><Edit className="w-4 h-4 mr-2" /> Edit</Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* ══════════════ QUOTATION DOCUMENT ══════════════ */}
      <div
        className="bg-white text-black mx-auto print:shadow-none print:m-0"
        style={{
          maxWidth: "210mm",
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          fontSize: "13px",
          color: C.value,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Watermark */}
        <img
          src={`${import.meta.env.BASE_URL}srs-logo.webp`}
          alt="" aria-hidden="true"
          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "55%", opacity: 0.045, pointerEvents: "none", userSelect: "none", zIndex: 0 }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ══ 1. PAGE TITLE ══ */}
          <div style={{ textAlign: "center", padding: "20px 32px 8px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: C.orange, letterSpacing: "1px" }}>Quotation</div>
          </div>

          {/* ══ 2. HEADER: Logo ↔ Quotation Meta ══ */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 32px 16px", borderBottom: `1px solid ${C.border}` }}>
            {/* Left: logo + company name */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img
                src={`${import.meta.env.BASE_URL}srs-logo.webp`}
                alt="SRS Controls"
                style={{ height: "56px", objectFit: "contain" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>SRS CONTROLS</div>
                <div style={{ fontSize: "11px", color: C.label }}>Manufacturers of: Electric Control Panels</div>
              </div>
            </div>
            {/* Right: QR + quotation meta */}
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <QRCodeSVG
                value={typeof window !== "undefined" ? window.location.href : `quotations/${id}`}
                size={64} level="M" includeMargin={false} fgColor={C.orange}
              />
              <div style={{ fontSize: "12px" }}>
                <span style={{ color: C.label }}>Quotation# </span>
                <strong>{quotation.quotationNo}</strong>
              </div>
              <div style={{ fontSize: "12px" }}>
                <span style={{ color: C.label }}>Date </span>
                <strong>{formatDate(quotation.date)}</strong>
              </div>
            </div>
          </div>

          {/* ══ 3. FROM / TO boxes ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "16px 32px", borderBottom: `1px solid ${C.border}` }}>
            {/* Quotation by */}
            <div style={{ border: `1px solid ${C.orangeBorder}`, borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ backgroundColor: C.orangeLight, borderBottom: `1px solid ${C.orangeBorder}`, padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: C.orange }}>
                Quotation by
              </div>
              <div style={{ padding: "12px 14px", fontSize: "12px", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, marginBottom: "2px" }}>SRS CONTROLS</div>
                <div style={{ color: C.label }}>New No. 97, Sanganoor Road, Ganapathy,</div>
                <div style={{ color: C.label }}>Coimbatore – 641 006</div>
                <div style={{ marginTop: "6px" }}>
                  <span style={{ color: C.label }}>GSTIN </span><strong>33AKQPS9506E1ZH</strong>
                </div>
                <div>
                  <span style={{ color: C.label }}>PAN </span><strong>AKQPS9506E</strong>
                </div>
              </div>
            </div>

            {/* Quotation to */}
            <div style={{ border: `1px solid ${C.orangeBorder}`, borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ backgroundColor: C.orangeLight, borderBottom: `1px solid ${C.orangeBorder}`, padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: C.orange }}>
                Quotation to
              </div>
              <div style={{ padding: "12px 14px", fontSize: "12px", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, marginBottom: "2px" }}>{quotation.client?.name}</div>
                <div style={{ color: C.label, whiteSpace: "pre-wrap" }}>{quotation.client?.address}</div>
                {quotation.client?.gstin && (
                  <div style={{ marginTop: "6px" }}>
                    <span style={{ color: C.label }}>GSTIN </span><strong>{quotation.client.gstin}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subject */}
          {quotation.subject && (
            <div style={{ padding: "10px 32px", borderBottom: `1px solid ${C.border}`, fontSize: "12px" }}>
              <span style={{ color: C.label }}>Sub: </span>
              <span style={{ fontWeight: 600 }}>{quotation.subject}</span>
            </div>
          )}

          {/* ══ 4. ITEMS TABLE ══ */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "50%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: C.header, color: C.headerText }}>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>#</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, fontSize: "12px" }}>Item / Description</th>
                <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Qty.</th>
                <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Rate</th>
                <th style={{ padding: "10px 16px 10px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 8px", textAlign: "center", color: C.label, fontSize: "12px", verticalAlign: "top" }}>{item.sNo}</td>
                  <td style={{ padding: "10px 8px", verticalAlign: "top", whiteSpace: "pre-wrap", fontSize: "12px" }}>
                    {item.description}
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "right", verticalAlign: "top", fontSize: "12px" }}>{item.qty ?? "—"}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", verticalAlign: "top", fontSize: "12px" }}>
                    {item.rate != null ? fmt(item.rate) : "—"}
                  </td>
                  <td style={{ padding: "10px 16px 10px 8px", textAlign: "right", fontWeight: 600, verticalAlign: "top" }}>
                    {fmt(item.amount)}
                  </td>
                </tr>
              ))}
              {Array.from({ length: fillerRows }).map((_, i) => (
                <tr key={`f${i}`} style={{ borderBottom: `1px solid ${C.border}`, height: "36px" }}>
                  {[0, 1, 2, 3, 4].map((c) => <td key={c} />)}
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ 5. FOOTER: Terms left | Totals right ══ */}
          <div style={{ display: "flex", borderTop: `2px solid ${C.border}` }}>
            {/* Left: Terms */}
            <div style={{ flex: 1, padding: "20px 32px", borderRight: `1px solid ${C.border}`, fontSize: "12px" }}>
              {[
                ["Terms and Conditions", null],
                ["Advance", quotation.termsAdvance],
                ["Delivery", quotation.termsDelivery],
                ["Transport", quotation.termsTransport],
                ["Tax", quotation.termsTax],
                ["Validity", quotation.termsValidity],
                ["Warranty", quotation.termsWarranty],
              ].map(([label, value], i) =>
                i === 0 ? (
                  <div key="title" style={{ fontWeight: 700, fontSize: "13px", color: C.orange, marginBottom: "10px" }}>{label}</div>
                ) : value ? (
                  <div key={label as string} style={{ marginBottom: "6px" }}>
                    <span style={{ color: C.label, minWidth: "80px", display: "inline-block" }}>{label}: </span>
                    <span>{value}</span>
                  </div>
                ) : null,
              )}

              {quotation.notes && (
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: C.orange, marginBottom: "6px" }}>Additional Notes</div>
                  <div style={{ color: C.label, lineHeight: 1.6 }}>{quotation.notes}</div>
                </div>
              )}
            </div>

            {/* Right: Totals */}
            <div style={{ width: "260px", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.label, fontSize: "12px" }}>Sub Total</span>
                <span style={{ fontWeight: 600 }}>{fmt(quotation.subtotal)}</span>
              </div>
              {quotation.discountPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.orange, fontSize: "12px", fontWeight: 600 }}>Discount ({quotation.discountPct}%)</span>
                  <span style={{ fontWeight: 600, color: C.orange }}>- {fmt(quotation.discountAmount)}</span>
                </div>
              )}
              {quotation.discountPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.label, fontSize: "12px" }}>After Discount</span>
                  <span style={{ fontWeight: 600 }}>{fmt(quotation.afterDiscountTotal)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.label, fontSize: "12px" }}>GST @ {quotation.gstRate}%</span>
                <span style={{ fontWeight: 600 }}>{fmt(quotation.gstAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.label, fontSize: "12px" }}>Round Off</span>
                <span style={{ fontWeight: 600 }}>{quotation.roundOff >= 0 ? "+" : ""}{quotation.roundOff.toFixed(2)}</span>
              </div>
              {/* Total */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", backgroundColor: C.orange }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: "14px" }}>Total</span>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: "16px" }}>{fmt(quotation.grandTotal)}</span>
              </div>
              {/* Amount in words */}
              <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, fontSize: "11px" }}>
                <div style={{ color: C.label, marginBottom: "4px" }}>Invoice Total (in words)</div>
                <div style={{ fontWeight: 600, fontSize: "12px", lineHeight: 1.5 }}>{quotation.amountInWords}</div>
              </div>
            </div>
          </div>

          {/* ══ 6. BANK DETAILS ══ */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px" }}>
            {[
              { bank: "KARUR VYSYA BANK", branch: "Thudiyalur", acc: "1721223000000070", ifsc: "KVBL0001721" },
              { bank: "INDUSIND BANK", branch: "G.N.Mills", acc: "201001628600", ifsc: "INDB0001017" },
            ].map((b) => (
              <div key={b.bank}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>RTGS — {b.bank}</div>
                <div><span style={{ color: C.label }}>Account Name: </span>SRS CONTROLS</div>
                <div><span style={{ color: C.label }}>Account No: </span>{b.acc}</div>
                <div><span style={{ color: C.label }}>Branch: </span>{b.branch}</div>
                <div><span style={{ color: C.label }}>IFSC: </span>{b.ifsc}</div>
              </div>
            ))}
          </div>

          {/* ══ 7. SIGNATURE ══ */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 32px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ textAlign: "center", minWidth: "160px" }}>
              <div style={{ fontWeight: 700, marginBottom: "44px", fontSize: "12px" }}>for SRS CONTROLS</div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "6px", fontSize: "11px", color: C.label }}>
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
