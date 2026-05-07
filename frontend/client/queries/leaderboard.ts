import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/client/client'
import { queryKeys } from '@/client/queryKeys'
import type { LeaderboardResponse } from '@/client/types'

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard.root,
    queryFn: ({ signal }) =>
      apiClient.get<LeaderboardResponse>('/api/leaderboard', signal),
  })
}
