import type { Granularity } from '@/api/types'

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
