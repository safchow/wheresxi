import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { readToken } from '@/api/tokenStorage'
import type { AuthResponse, PublicUser } from '@/api/types'

export function useMe() {
  const enabled = !!readToken()
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) =>
      apiClient.get<{ user: PublicUser }>('/api/auth/me', signal),
    enabled,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      apiClient.post<AuthResponse>('/api/auth/login', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      inviteToken: string
      username: string
      name: string
      password: string
    }) => apiClient.post<AuthResponse>('/api/auth/signup', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.taylor })
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: true }>('/api/auth/logout'),
  })
}
