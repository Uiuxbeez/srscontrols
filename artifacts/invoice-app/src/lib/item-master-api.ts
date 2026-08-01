import { customFetch } from "@workspace/api-client-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getListCategoriesQueryKey, getListSubCategoriesQueryKey, getListItemsQueryKey } from "@workspace/api-client-react"

export interface ParsedPage {
  pageNumber: number
  lines: string[]
}

export interface ParsePdfResponse {
  pages: ParsedPage[]
}

export function useParsePdf() {
  return useMutation<ParsePdfResponse, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append("file", file)
      return customFetch<ParsePdfResponse>("/api/item-master/parse-pdf", {
        method: "POST",
        body: formData,
      })
    },
  })
}

export interface ImportItemPayload {
  name: string
  catNo?: string
  price?: number | null
  packQty?: number | null
  specifications?: string
}

export interface ImportPayload {
  categoryName: string
  subCategories: Array<{ name: string; items: ImportItemPayload[] }>
}

export function useImportItemMaster() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, ImportPayload>({
    mutationFn: (data) =>
      customFetch("/api/item-master/import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
      qc.invalidateQueries({ queryKey: getListSubCategoriesQueryKey() })
      qc.invalidateQueries({ queryKey: getListItemsQueryKey() })
    },
  })
}
