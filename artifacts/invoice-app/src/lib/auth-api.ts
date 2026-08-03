import { customFetch, ApiError } from "@workspace/api-client-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface AuthStatus {
  ok: true
}

export const authMeQueryKey = ["auth", "me"] as const

export function useAuthMe() {
  return useQuery<AuthStatus | null>({
    queryKey: authMeQueryKey,
    queryFn: async () => {
      try {
        return await customFetch<AuthStatus>("/api/auth/me")
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    retry: false,
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation<AuthStatus, Error, { password: string }>({
    mutationFn: (data) =>
      customFetch<AuthStatus>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (status) => {
      qc.setQueryData(authMeQueryKey, status)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await customFetch("/api/auth/logout", { method: "POST" })
    },
    onSuccess: () => {
      qc.setQueryData(authMeQueryKey, null)
      qc.clear()
    },
  })
}
