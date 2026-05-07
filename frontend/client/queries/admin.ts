import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/client/client'
import { queryKeys } from '@/client/queryKeys'
import type {
  BetWithUser,
  BustReason,
  InviteToken,
  MarketDay,
  RefundMarketResponse,
  ResolveMarketResponse,
  Role,
} from '@/client/types'

export function useAdminMarkets() {
  return useQuery({
    queryKey: queryKeys.admin.markets,
    queryFn: ({ signal }) =>
      apiClient.get<{ markets: MarketDay[] }>('/api/admin/markets', signal),
  })
}

export function useAdminMarketBets(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.marketBets(id),
    queryFn: ({ signal }) =>
      apiClient.get<{ bets: BetWithUser[] }>(
        `/api/admin/markets/${id}/bets`,
        signal,
      ),
    enabled,
  })
}

export function useAdminResolveMarket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      date: string
      arrivedAtMinute?: number | null
      bustReason?: BustReason | null
    }) =>
      apiClient.post<ResolveMarketResponse>(
        '/api/admin/markets/resolve',
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.markets })
      queryClient.invalidateQueries({ queryKey: queryKeys.market.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.bets.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.taylor })
    },
  })
}

export function useAdminRefundMarket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { date: string }) =>
      apiClient.post<RefundMarketResponse>(
        '/api/admin/markets/refund',
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.markets })
      queryClient.invalidateQueries({ queryKey: queryKeys.market.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.bets.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.taylor })
    },
  })
}

export function useAdminInvites() {
  return useQuery({
    queryKey: queryKeys.admin.invites,
    queryFn: ({ signal }) =>
      apiClient.get<{ invites: InviteToken[] }>('/api/admin/invites', signal),
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      expiresInDays?: number | null
      note?: string | null
      grantsRole?: Role | null
    }) => apiClient.post<{ invite: InviteToken }>('/api/admin/invites', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.invites })
    },
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<void>(`/api/admin/invites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.invites })
    },
  })
}
