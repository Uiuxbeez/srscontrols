import { customFetch, getListPanelsQueryKey } from "@workspace/api-client-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export interface BulkImportComponent {
  component: string
  note: string
}

export interface BulkImportPanelsInput {
  panelName: string
  components: BulkImportComponent[]
}

export interface BulkImportPanelsResponse {
  panel: { id: number; name: string }
  added: number
  skipped: string[]
  created: boolean
}

export function useBulkImportPanelComponents() {
  const qc = useQueryClient()
  return useMutation<BulkImportPanelsResponse, Error, BulkImportPanelsInput>({
    mutationFn: (data) =>
      customFetch("/api/panels/bulk-import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListPanelsQueryKey() })
    },
  })
}
