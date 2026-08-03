import { customFetch } from "@workspace/api-client-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getListTechSpecItemsQueryKey } from "@workspace/api-client-react"

export interface BulkImportItem {
  itemName: string
  defaultSpec: string
}

export interface BulkImportResponse {
  inserted: Array<{ id: number; itemName: string; defaultSpec: string }>
  skipped: string[]
}

export function useBulkImportTechSpecItems() {
  const qc = useQueryClient()
  return useMutation<BulkImportResponse, Error, BulkImportItem[]>({
    mutationFn: (items) =>
      customFetch("/api/tech-spec-items/bulk-import", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTechSpecItemsQueryKey() })
    },
  })
}
