import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { readToken } from '@/api/tokenStorage'
import type {
  AuthResponse,
  Bet,
  BetWithUser,
  BustReason,
  Granularity,
  InviteToken,
  LeaderboardResponse,
  MarketDay,
  PlaceBetInput,
  PublicUser,
  RefundMarketResponse,
  ResolveMarketResponse,
  TaylorStats,
  WeekMarketsResponse,
} from '@/api/types'

/**
 * Centralized query keys. Hierarchical so we can invalidate by prefix:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.market.root })
 */
export const queryKeys = {
  me: ['me'] as const,
  market: {
    root: ['market'] as const,
    week: (granularity: Granularity) => ['market', 'week', granularity] as const,
    exactMinute: (marketDayId: string, minute: number) =>
      ['market', marketDayId, 'exact', minute] as const,
  },
  bets: {
    root: ['bets'] as const,
    mine: ['bets', 'mine'] as const,
  },
  leaderboard: {
    root: ['leaderboard'] as const,
  },
  stats: {
    taylor: ['stats', 'taylor'] as const,
  },
  admin: {
    markets: ['admin', 'markets'] as const,
    marketBets: (id: string) => ['admin', 'markets', id, 'bets'] as const,
    invites: ['admin', 'invites'] as const,
  },
}

/* ─── auth ──────────────────────────────────────────────────────────── */

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

/* ─── market & bets ─────────────────────────────────────────────────── */

/** Shared fetcher so the single-granularity hook and the all-granularity
 *  prefetcher can't drift apart. */
const weekMarketsFetcher = (granularity: Granularity, signal?: AbortSignal) =>
  apiClient.get<WeekMarketsResponse>(
    `/api/market/week?granularity=${granularity}`,
    signal,
  )

export function useWeekMarkets(granularity: Granularity) {
  return useQuery({
    queryKey: queryKeys.market.week(granularity),
    queryFn: ({ signal }) => weekMarketsFetcher(granularity, signal),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  })
}

/**
 * Fetch every granularity's bucket grid in parallel on mount. Only the
 * `active` granularity polls; the rest sit warm in the cache so switching
 * tabs is an instant cache read instead of a fresh request.
 */
export function useAllWeekMarkets(active: Granularity) {
  const granularities: Granularity[] = [
    'HALF_HOUR',
    'QUARTER_HOUR',
    'FIVE_MIN',
    'EXACT',
  ]
  const queries = useQueries({
    queries: granularities.map((g) => ({
      queryKey: queryKeys.market.week(g),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        weekMarketsFetcher(g, signal),
      // Only the user's currently-selected tab polls; the others were
      // fetched once on mount and are happy sitting in cache until clicked.
      refetchInterval: g === active ? 15_000 : false,
      placeholderData: keepPreviousData,
    })),
  })
  const activeQuery = queries[granularities.indexOf(active)]
  return { queries, activeQuery }
}

export function useExactMinuteGuesses(
  marketDayId: string | null,
  minute: number,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.market.exactMinute(marketDayId ?? '_', minute),
    queryFn: ({ signal }) =>
      apiClient.get<{ minute: number; guesses: number }>(
        `/api/market/${marketDayId}/exact-minute?minute=${minute}`,
        signal,
      ),
    enabled: !!marketDayId && enabled,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  })
}

export function usePlaceBet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceBetInput) =>
      apiClient.post<{ bet: Bet }>('/api/bets', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.market.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.bets.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.root })
    },
  })
}

export function useMyBets() {
  return useQuery({
    queryKey: queryKeys.bets.mine,
    queryFn: ({ signal }) =>
      apiClient.get<{ bets: Bet[] }>('/api/bets/me', signal),
  })
}

export function useCancelBet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (betId: string) =>
      apiClient.delete<{ bet: Bet }>(`/api/bets/${betId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.market.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.bets.root })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.root })
    },
  })
}

export function useDeclareBankruptcy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<{ credits: number }>('/api/bankruptcy'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.root })
    },
  })
}

/* ─── leaderboard ───────────────────────────────────────────────────── */

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard.root,
    queryFn: ({ signal }) =>
      apiClient.get<LeaderboardResponse>('/api/leaderboard', signal),
  })
}

/* ─── stats ─────────────────────────────────────────────────────────── */

export function useTaylorStats() {
  return useQuery({
    queryKey: queryKeys.stats.taylor,
    queryFn: ({ signal }) =>
      apiClient.get<TaylorStats>('/api/stats/taylor', signal),
  })
}

/* ─── admin ─────────────────────────────────────────────────────────── */

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
      grantsRole?: 'USER' | 'ADMIN' | null
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
