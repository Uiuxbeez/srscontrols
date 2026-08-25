import { useGetPurchaseOrder, useDeletePurchaseOrder, getListPurchaseOrdersQueryKey, getGetPurchaseOrderQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { ArrowLeft, Edit, Landmark, Mail, MapPin, Phone, Printer, ReceiptText, Trash2, UserRound } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { isInterState } from "@/lib/gst"
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

const COL = {
  header: "#006b2d",
  headerText: "#ffffff",
  border: "#9bc8a8",
  softBorder: "#cfe3d4",
  label: "#0b4f24",
  value: "#111827",
  panelBg: "#f8fcf9",
}

const COMPANY = {
  name: "SRS CONTROLS",
  tagline: "Manufacturers of: Electric Control Panels",
  addressLines: ["100/2, Kurudampalayam Village, K.Vadamadurai, Thudiyalur, Coimbatore – 641017"],
  gstin: "33AYQPK2144P1ZZ",
  stateCode: "33",
  email: "srscontrols2012@gmail.com",
  website: "www.srscontrols.com",
  phone: "+91 9843589524",
}

const BANK_DETAILS = {
  bankName: "KARUR VYSYA BANK",
  accountName: "SRS CONTROLS",
  accountNo: "1721223000000070",
  branch: "Thudiyalur",
  ifsc: "KVBL0001721",
}

const formatAmount = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PurchaseOrderDetail() {
  const params = useParams()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: po, isLoading } = useGetPurchaseOrder(id, {
    query: { enabled: !!id, queryKey: getGetPurchaseOrderQueryKey(id) },
  })

  const deletePo = useDeletePurchaseOrder()

  const handleDelete = () => {
    deletePo.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Purchase order deleted successfully" })
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() })
        setLocation("/purchase-orders")
      },
      onError: () => {
        toast({ title: "Failed to delete purchase order", variant: "destructive" })
      },
    })
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const shouldPrint = params.get("print") === "1" || params.get("print") === "true"
    if (shouldPrint) {
      setTimeout(() => window.print(), 300)
    }
  }, [po])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[800px] w-full" />
      </div>
    )
  }

  if (!po) return <div>Purchase order not found</div>

  const fillerRows = Math.max(0, 1 - po.items.length)
  const totalQty = po.items.reduce((sum, i) => sum + (i.qty ?? 0), 0)
  const interState = isInterState(po.client.gstin)
  const igstRate = po.cgstRate + po.sgstRate
  const igstAmount = po.cgstAmount + po.sgstAmount

  return (
    <div className="space-y-6">
      {/* ── Toolbar (hidden on print) ── */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/purchase-orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Purchase Order PO-{po.poNo}
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
                <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this purchase order. This action cannot be undone.
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
            <Link href={`/purchase-orders/${id}/edit`}><Edit className="w-4 h-4 mr-2" /> Edit</Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          PURCHASE ORDER DOCUMENT
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

          {/* ══ 1. HEADER ══ */}
          <div style={{ position: "relative", padding: "10px 10px 10px", borderBottom: `1px solid ${COL.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Landmark size={13} color={COL.header} /> {COMPANY.website}
                    </div>
                    <div style={{ marginTop: "3px", fontWeight: 800 }}>
                      GST No.: {COMPANY.gstin} &nbsp;|&nbsp; State Code: {COMPANY.stateCode}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                <div style={{ color: COL.header, fontSize: "18px", fontWeight: 900, letterSpacing: "1px" }}>PURCHASE ORDER</div>
              </div>
            </div>
          </div>

          {/* ══ 2. TO + REFERENCE DETAILS ══ */}
          <div style={{ padding: "10px 10px 0px" }}>
            <div style={{ border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden", backgroundColor: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", color: COL.label, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", backgroundColor: COL.panelBg, borderBottom: `1px solid ${COL.softBorder}` }}>
                <UserRound size={16} /> To
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.35fr", gap: "14px", padding: "7px 7px 7px" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "14px", marginBottom: "8px" }}>{po.client.name}</div>
                  <div style={{ fontSize: "12.5px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{po.client.address}</div>
                  {po.client.phone && <div style={{ fontSize: "12.5px", lineHeight: 1.6 }}>M.{po.client.phone}</div>}
                  <div style={{ fontSize: "12.5px", lineHeight: 1.6, fontWeight: 700 }}>GST No. : {po.client.gstin || "-"}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden", backgroundColor: "#fff" }}>
                  {[
                    ["PO No.", `PO-${po.poNo}`],
                    ["PO Date", formatDate(po.date)],
                    ["Delivery Location", po.deliveryLocation || "-"],
                    ["Terms of Delivery", po.termsOfDelivery || "-"],
                    ["Mode / Terms of Payment", po.modeOfPayment || "-"],
                  ].map(([label, value], index) => (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "50% 1fr", minHeight: "28px", borderRight: index % 2 === 0 ? `1px solid ${COL.softBorder}` : "none", borderBottom: index < 4 ? `1px solid ${COL.softBorder}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", padding: "3px 7px", color: COL.label, fontSize: "11.5px", fontWeight: 700, backgroundColor: COL.panelBg }}>
                        {label}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", padding: "3px 7px", fontSize: "11.5px", fontWeight: 700 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ══ 3. LINE ITEMS TABLE ══ */}
          <table style={{ width: "calc(100% - 20px)", margin: "8px 10px 0", borderCollapse: "separate", borderSpacing: 0, border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "38%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: COL.header, color: COL.headerText }}>
                <th style={{ padding: "5px 5px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>S.No.</th>
                <th style={{ padding: "5px 5px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Description</th>
                <th style={{ padding: "5px 5px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Quantity</th>
                <th style={{ padding: "5px 5px", textAlign: "right", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Rate</th>
                <th style={{ padding: "5px 5px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Per</th>
                <th style={{ padding: "5px 5px", textAlign: "center", fontWeight: 800, fontSize: "12px", borderRight: "1px solid rgba(255,255,255,0.25)" }}>Disc%</th>
                <th style={{ padding: "10px 10px 5px 5px", textAlign: "right", fontWeight: 800, fontSize: "12px" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} style={{ backgroundColor: "#fff" }}>
                  <td style={{ padding: "5px 5px", textAlign: "center", fontSize: "12px", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.sNo}</td>
                  <td style={{ padding: "5px 5px", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>
                    <div style={{ fontWeight: 500 }}>{item.description}</div>
                  </td>
                  <td style={{ padding: "5px 5px", textAlign: "center", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.qty ?? "—"}</td>
                  <td style={{ padding: "5px 5px", textAlign: "right", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.rate != null ? formatAmount(item.rate) : "—"}</td>
                  <td style={{ padding: "5px 5px", textAlign: "center", fontSize: "12px", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.per || "—"}</td>
                  <td style={{ padding: "5px 5px", textAlign: "center", fontSize: "12px", borderRight: `1px solid ${COL.softBorder}`, borderBottom: `1px solid ${COL.softBorder}` }}>{item.discountPct ? `${item.discountPct}%` : "—"}</td>
                  <td style={{ padding: "10px 10px 5px 5px", textAlign: "right", fontWeight: 700, borderBottom: `1px solid ${COL.softBorder}` }}>{formatAmount(item.amount)}</td>
                </tr>
              ))}
              {Array.from({ length: fillerRows }).map((_, i) => (
                <tr key={`f${i}`} style={{ borderBottom: `1px solid ${COL.border}`, height: "40px" }}>
                  {[0, 1, 2, 3, 4, 5, 6].map(c => <td key={c} />)}
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ padding: "11px 12px", fontSize: "12px", color: COL.label, fontWeight: 800 }}>
                  Total Quantity: {totalQty}
                </td>
                <td colSpan={3} style={{ padding: "11px 8px" }} />
                <td style={{ padding: "11px 8px", textAlign: "right", color: COL.value, fontWeight: 700, fontSize: "12px" }}>Sub Total</td>
                <td style={{ padding: "11px 10px 11px 8px", textAlign: "right", fontWeight: 800 }}>
                  {formatAmount(po.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ══ 4. FOOTER: Amount in words left | Totals box right ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.95fr", margin: "10px 10px 0", border: `1px solid ${COL.border}`, borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ padding: "7px 7px", borderRight: `1px solid ${COL.softBorder}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "145px 1fr", alignItems: "center", fontSize: "12px", color: COL.label, fontWeight: 800, paddingBottom: "10px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span>Total Quantity</span>
                <span>: &nbsp; {totalQty}</span>
              </div>
              <div style={{ paddingTop: "12px" }}>
                <div style={{ fontSize: "12px", color: COL.label, fontWeight: 800, marginBottom: "6px" }}>Amount (in words)</div>
                <div style={{ fontWeight: 800, fontSize: "14px", lineHeight: 1.35 }}>INR {po.amountInWords}</div>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Sub Total</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(po.subtotal)}</span>
              </div>
              {interState ? (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                  <span style={{ fontSize: "12px" }}>Output IGST Taxes</span>
                  <span style={{ fontWeight: 700 }}>₹ {formatAmount(igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                    <span style={{ fontSize: "12px" }}>Output CGST Taxes</span>
                    <span style={{ fontWeight: 700 }}>₹ {formatAmount(po.cgstAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                    <span style={{ fontSize: "12px" }}>Output SGST Taxes</span>
                    <span style={{ fontWeight: 700 }}>₹ {formatAmount(po.sgstAmount)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px", borderBottom: `1px solid ${COL.softBorder}` }}>
                <span style={{ fontSize: "12px" }}>Round Off</span>
                <span style={{ fontWeight: 700 }}>₹ {formatAmount(po.roundOff)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 7px", backgroundColor: COL.header, color: "#fff" }}>
                <span style={{ fontWeight: 900, fontSize: "14px" }}>GRAND TOTAL</span>
                <span style={{ fontWeight: 900, fontSize: "16px" }}>₹ {formatAmount(po.netTotal)}</span>
              </div>
            </div>
          </div>

          {/* ══ 5. NOTES + BANK DETAILS ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.9fr", gap: "10px", margin: "10px 10px 0" }}>
            <div style={{ padding: "7px 7px", border: `1px solid ${COL.border}`, borderRadius: "4px", minHeight: "120px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 900, fontSize: "13px", marginBottom: "8px", color: COL.label, textTransform: "uppercase" }}>
                <ReceiptText size={17} /> Notes
              </div>
              <div style={{ color: COL.value, fontSize: "11.5px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {po.notes || "—"}
              </div>
            </div>
            <div style={{ padding: "7px 7px", border: `1px solid ${COL.border}`, borderRadius: "4px", minHeight: "120px" }}>
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

          {/* ══ 6. SIGNATURE ══ */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 32px 24px" }}>
            <div style={{ textAlign: "center", minWidth: "160px" }}>
              <div style={{ fontWeight: 700, marginBottom: "44px", fontSize: "12px" }}>for SRS CONTROLS</div>
              <div style={{ borderTop: "1px dashed " + COL.border, paddingTop: "6px", fontSize: "11px", color: COL.label }}>
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
