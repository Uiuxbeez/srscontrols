import { useEffect } from "react"
import { useParams, useLocation, Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { useGetQuotation, useDeleteQuotation, quotationKeys } from "@/lib/quotation-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Edit, Printer, Trash2, User, ClipboardList, Landmark } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/* ─── Colour tokens (matches the invoice's green palette) ─── */
const C = {
  accent: "#006b2d",
  accentLight: "#f8fcf9",
  accentBorder: "#9bc8a8",
  softBorder: "#cfe3d4",
  header: "#006b2d",
  headerText: "#ffffff",
  border: "#9bc8a8",
  label: "#0b4f24",
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

/* breakdownText is stored as one "Component - Note" (or bare Component) per line */
function parseBreakdown(text: string): { component: string; note: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf(" - ")
      if (idx === -1) return { component: line, note: "" }
      return { component: line.slice(0, idx), note: line.slice(idx + 3) }
    })
}

export default function QuotationDetail() {
  const params = useParams()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: quotation, isLoading } = useGetQuotation(id)
  const deleteQuotation = useDeleteQuotation()
  const isDuplicateCopy = (() => {
    if (typeof window === "undefined") return false
    const params = new URLSearchParams(window.location.search)
    return params.get("duplicateCopy") === "1" || params.get("copyType") === "duplicate"
  })()

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

  const handleDuplicatePrint = () => {
    window.location.href = `/quotations/${id}?print=1&duplicateCopy=1`
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const shouldPrint = params.get("print") === "1" || params.get("print") === "true"
    const isPdfRender = params.get("pdfRender") === "1" || params.get("pdf") === "1"
    if (shouldPrint && !isPdfRender) {
      setTimeout(() => window.print(), 300)
    }
  }, [quotation])

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[900px] w-full" />
    </div>
  )

  if (!quotation) return <div className="p-8 text-center text-muted-foreground">Quotation not found.</div>

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
          <Button variant="outline" onClick={handleDuplicatePrint}>
            Duplicate Copy
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
          border: `1.5px solid ${C.accent}`,
          borderRadius: "8px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "24px 32px 8px" }}>
            <div style={{ flex: 1, height: "2px", backgroundColor: C.accentBorder }} />
            <div style={{ fontSize: "24px", fontWeight: 700, color: C.accent, letterSpacing: "2px", textTransform: "uppercase" }}>Quotation</div>
            <div style={{ flex: 1, height: "2px", backgroundColor: C.accentBorder }} />
          </div>

          {/* ══ 2. HEADER: Logo ↔ Quotation Meta ══ */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 32px 16px" }}>
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
              <div style={{ fontSize: "11px", fontWeight: 800, color: C.value }}>
                {isDuplicateCopy ? "DUPLICATE COPY" : "(ORIGINAL FOR RECIPIENT)"}
              </div>
              <QRCodeSVG
                value={typeof window !== "undefined" ? window.location.href : `quotations/${id}`}
                size={64} level="M" includeMargin={false} fgColor={C.accent}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "16px 32px" }}>
            {/* Quotation by */}
            <div style={{ border: `1px solid ${C.accentBorder}`, borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: 800, color: C.label, textTransform: "uppercase", backgroundColor: C.accentLight, borderBottom: `1px solid ${C.softBorder}` }}>
                <User size={16} /> Quotation by
              </div>
              <div style={{ padding: "12px 14px", fontSize: "12px", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, marginBottom: "2px" }}>SRS CONTROLS</div>
                <div style={{ color: C.label }}>Manufacturers of: Electric Control Panels, 100/2, Kurudampalayam Village, K.Vadamadurai,</div>
                <div style={{ color: C.label }}>Thudiyalur, Coimbatore – 641017</div>
                <div style={{ marginTop: "6px" }}>
                  <span style={{ color: C.label }}>GSTIN </span><strong>33AYQPK2144P1ZZ</strong>
                </div>
                <div>
                  <span style={{ color: C.label }}>PAN </span><strong>AYQPK2144P</strong>
                </div>
              </div>
            </div>

            {/* Quotation to */}
            <div style={{ border: `1px solid ${C.accentBorder}`, borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: 800, color: C.label, textTransform: "uppercase", backgroundColor: C.accentLight, borderBottom: `1px solid ${C.softBorder}` }}>
                <User size={16} /> Quotation to
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

          {/* ══ 3b. TECHNICAL SPECIFICATION ══ */}
          {quotation.techSpecs.length > 0 && (
            <div style={{ borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: "10px 32px 6px", fontWeight: 700, fontSize: "13px", color: C.accent }}>
                Technical Specification
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "60%" }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: C.header, color: C.headerText }}>
                    <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>#</th>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600, fontSize: "12px" }}>Item</th>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600, fontSize: "12px" }}>Spec / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.techSpecs.map((spec, idx) => (
                    <tr key={spec.id} style={{ borderBottom: `1px solid ${C.softBorder}`, backgroundColor: idx % 2 === 0 ? "#fff" : C.accentLight }}>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: C.label, fontSize: "12px" }}>{idx + 1}</td>
                      <td style={{ padding: "8px 8px", fontSize: "12px", fontWeight: 600 }}>{spec.itemName}</td>
                      <td style={{ padding: "8px 32px 8px 8px", fontSize: "12px" }}>{spec.spec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ 3c. PANEL SPECIFICATION ══ */}
          {quotation.panelSpecs.length > 0 && (
            <div style={{ borderBottom: `1px solid ${C.border}` }}>
              {quotation.panelSpecs.map((spec, idx) => (
                <div key={spec.id} style={{ padding: "14px 32px", borderBottom: idx < quotation.panelSpecs.length - 1 ? `1px solid ${C.border}` : undefined }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: C.accent, marginBottom: "8px" }}>
                    {idx + 1}. {spec.panelName}
                  </div>
                  {spec.breakdownText && (
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", border: `1px solid ${C.accentBorder}`, borderRadius: "4px" }}>
                      <colgroup>
                        <col style={{ width: "6%" }} />
                        <col style={{ width: "64%" }} />
                        <col style={{ width: "30%" }} />
                      </colgroup>
                      <tbody>
                        {parseBreakdown(spec.breakdownText).map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.softBorder}` }}>
                            <td style={{ padding: "6px 8px", textAlign: "center", color: C.label, fontSize: "12px", borderRight: `1px solid ${C.softBorder}` }}>{i + 1}</td>
                            <td style={{ padding: "6px 8px", fontSize: "12px", fontWeight: 600, borderRight: `1px solid ${C.softBorder}` }}>{row.component}</td>
                            <td style={{ padding: "6px 8px", fontSize: "12px" }}>{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {(() => {
                    const matchedItem = quotation.items.find((i) => i.description === spec.panelName)
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <div style={{ display: "flex", gap: "20px" }}>
                          {spec.panelSize && (
                            <div>
                              <span style={{ color: C.label }}>Panel Size </span>
                              <strong>{spec.panelSize}</strong>
                            </div>
                          )}
                          {spec.frameSize && (
                            <div>
                              <span style={{ color: C.label }}>Frame Size </span>
                              <strong>{spec.frameSize}</strong>
                            </div>
                          )}
                        </div>
                        {matchedItem && (
                          <div style={{ display: "flex", gap: "20px" }}>
                            <div><span style={{ color: C.label }}>Qty </span><strong>{matchedItem.qty ?? "—"}</strong></div>
                            <div><span style={{ color: C.label }}>Rate </span><strong>{matchedItem.rate != null ? fmt(matchedItem.rate) : "—"}</strong></div>
                            <div><span style={{ color: C.label }}>Amount </span><strong>{fmt(matchedItem.amount)}</strong></div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}



          {/* ══ 5. TOTAL PRICE LIST ══ */}
          <div style={{ padding: "16px 32px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: C.accent, marginBottom: "8px" }}>
              Total Price List
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${C.accentBorder}` }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "60%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: C.header, color: C.headerText }}>
                  <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600, fontSize: "12px" }}>S.No</th>
                  <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600, fontSize: "12px" }}>Description</th>
                  <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: "12px" }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, i) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${C.softBorder}` }}>
                    <td style={{ padding: "7px 8px", textAlign: "center", fontSize: "12px", color: C.label }}>{i + 1}</td>
                    <td style={{ padding: "7px 8px", fontSize: "12px" }}>{item.description}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontSize: "12px", fontFamily: "monospace" }}>{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${C.accentBorder}` }}>
                  <td colSpan={2} style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.label }}>Total</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>{fmt(quotation.subtotal)}</td>
                </tr>
                {quotation.discountPct > 0 && (
                  <tr style={{ borderTop: `1px solid ${C.softBorder}` }}>
                    <td colSpan={2} style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.accent }}>Discount ({quotation.discountPct}%)</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace", color: C.accent }}>- {fmt(quotation.discountAmount)}</td>
                  </tr>
                )}
                {quotation.discountPct > 0 && (
                  <tr style={{ borderTop: `1px solid ${C.softBorder}` }}>
                    <td colSpan={2} style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.label }}>After Discount</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>{fmt(quotation.afterDiscountTotal)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: `1px solid ${C.softBorder}` }}>
                  <td colSpan={2} style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.label }}>GST @ {quotation.gstRate}%</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>{fmt(quotation.gstAmount)}</td>
                </tr>
                <tr style={{ borderTop: `1px solid ${C.softBorder}` }}>
                  <td colSpan={2} style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.label }}>Round Off</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>{quotation.roundOff >= 0 ? "+" : ""}{quotation.roundOff.toFixed(2)}</td>
                </tr>
                <tr style={{ borderTop: `1px solid ${C.accentBorder}`, backgroundColor: C.accent }}>
                  <td colSpan={2} style={{ padding: "10px 8px", textAlign: "right", fontSize: "13px", fontWeight: 700, color: "#fff" }}>Grand Total</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontSize: "14px", fontWeight: 700, fontFamily: "monospace", color: "#fff" }}>{fmt(quotation.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
            <div style={{ marginTop: "8px", fontSize: "11px" }}>
              <span style={{ color: C.label }}>Grand Total (in words): </span>
              <span style={{ fontWeight: 600 }}>{quotation.amountInWords}</span>
            </div>
          </div>

          {/* ══ 6. FOOTER: Terms and Conditions ══ */}
          <div style={{ padding: "16px 32px" }}>
            <div style={{ border: `1px solid ${C.accentBorder}`, borderRadius: "4px", overflow: "hidden", fontSize: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", fontWeight: 800, fontSize: "13px", color: C.label, textTransform: "uppercase", letterSpacing: "0.5px", backgroundColor: C.accentLight, borderBottom: `1px solid ${C.softBorder}` }}>
                <ClipboardList size={16} /> Terms and Conditions
              </div>
              <div style={{ padding: "12px 16px" }}>
              {[
                ["Advance", quotation.termsAdvance],
                ["Delivery", quotation.termsDelivery],
                ["Transport", quotation.termsTransport],
                ["Tax", quotation.termsTax],
                ["Validity", quotation.termsValidity],
                ["Warranty", quotation.termsWarranty],
              ].map(([label, value]) =>
                value ? (
                  <div key={label as string} style={{ marginBottom: "6px" }}>
                    <span style={{ color: C.label, minWidth: "80px", display: "inline-block" }}>{label}: </span>
                    <span>{value}</span>
                  </div>
                ) : null,
              )}

              {quotation.notes && (
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: C.accent, marginBottom: "6px" }}>Additional Notes</div>
                  <div style={{ color: C.label, lineHeight: 1.6 }}>{quotation.notes}</div>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* ══ 6. BANK DETAILS ══ */}
          <div style={{ padding: "0 32px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px" }}>
            {[
              { bank: "KARUR VYSYA BANK", branch: "Thudiyalur", acc: "1721223000000070", ifsc: "KVBL0001721" },
              { bank: "INDUSIND BANK", branch: "G.N.Mills", acc: "201001628600", ifsc: "INDB0001017" },
            ].map((b) => (
              <div key={b.bank} style={{ border: `1px solid ${C.accentBorder}`, borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", fontWeight: 800, color: C.label, textTransform: "uppercase", letterSpacing: "0.5px", backgroundColor: C.accentLight, borderBottom: `1px solid ${C.softBorder}` }}>
                  <Landmark size={16} /> RTGS — {b.bank}
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div><span style={{ color: C.label }}>Account Name: </span>SRS CONTROLS</div>
                  <div><span style={{ color: C.label }}>Account No: </span>{b.acc}</div>
                  <div><span style={{ color: C.label }}>Branch: </span>{b.branch}</div>
                  <div><span style={{ color: C.label }}>IFSC: </span>{b.ifsc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ══ 7. SIGNATURE ══ */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 32px 24px" }}>
            <div style={{ textAlign: "center", minWidth: "160px" }}>
              <div style={{ fontWeight: 700, marginBottom: "44px", fontSize: "12px" }}>for SRS CONTROLS</div>
              <div style={{ borderTop: `1px dashed ${C.accentBorder}`, paddingTop: "6px", fontSize: "11px", color: C.label }}>
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
