import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

/* ─── Types ─── */
export interface QuotationItem {
  id: number
  quotationId: number
  sNo: number
  description: string
  qty: number | null
  rate: number | null
  amount: number
}

export interface QuotationClient {
  id: number
  name: string
  address: string
  gstin: string | null
  phone: string | null
  email: string | null
}

export interface Quotation {
  id: number
  quotationNo: string
  date: string
  clientId: number
  subject: string | null
  discountPct: number
  gstRate: number
  subtotal: number
  discountAmount: number
  afterDiscountTotal: number
  gstAmount: number
  roundOff: number
  grandTotal: number
  amountInWords: string
  termsAdvance: string | null
  termsDelivery: string | null
  termsTransport: string | null
  termsTax: string | null
  termsValidity: string | null
  termsWarranty: string | null
  notes: string | null
  createdAt: string
  client: QuotationClient
  items: QuotationItem[]
}

export interface QuotationListItem {
  id: number
  quotationNo: string
  date: string
  clientId: number
  clientName: string
  subject: string | null
  grandTotal: number
  createdAt: string
}

export interface CreateQuotationInput {
  quotationNo: string
  date: string
  clientId: number
  subject?: string
  discountPct: number
  gstRate: number
  termsAdvance?: string
  termsDelivery?: string
  termsTransport?: string
  termsTax?: string
  termsValidity?: string
  termsWarranty?: string
  notes?: string
  items: Array<{
    sNo: number
    description: string
    qty?: number | null
    rate?: number | null
    amount: number
  }>
}

/* ─── Query Keys ─── */
export const quotationKeys = {
  all: ["quotations"] as const,
  list: (params?: object) => ["quotations", "list", params] as const,
  detail: (id: number) => ["quotations", "detail", id] as const,
  nextNumber: () => ["quotations", "next-number"] as const,
}

/* ─── API fetch helper ─── */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ─── Hooks ─── */
export function useListQuotations(params?: { search?: string; clientId?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set("search", params.search)
  if (params?.clientId) qs.set("clientId", String(params.clientId))
  const query = qs.toString()
  return useQuery<QuotationListItem[]>({
    queryKey: quotationKeys.list(params),
    queryFn: () => apiFetch(`/api/quotations${query ? `?${query}` : ""}`),
  })
}

export function useGetQuotation(id: number) {
  return useQuery<Quotation>({
    queryKey: quotationKeys.detail(id),
    queryFn: () => apiFetch(`/api/quotations/${id}`),
    enabled: !!id && !isNaN(id),
  })
}

export function useGetNextQuotationNumber() {
  return useQuery<{ nextNumber: string }>({
    queryKey: quotationKeys.nextNumber(),
    queryFn: () => apiFetch("/api/quotations/next-number"),
  })
}

export function useCreateQuotation() {
  const qc = useQueryClient()
  return useMutation<Quotation, Error, CreateQuotationInput>({
    mutationFn: (data) =>
      apiFetch("/api/quotations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quotationKeys.all }),
  })
}

export function useUpdateQuotation() {
  const qc = useQueryClient()
  return useMutation<Quotation, Error, { id: number; data: Partial<CreateQuotationInput> }>({
    mutationFn: ({ id, data }) =>
      apiFetch(`/api/quotations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: quotationKeys.all })
      qc.setQueryData(quotationKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteQuotation() {
  const qc = useQueryClient()
  return useMutation<{ success: boolean }, Error, number>({
    mutationFn: (id) => apiFetch(`/api/quotations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quotationKeys.all }),
  })
}
