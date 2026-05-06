import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { LeaderboardResponse } from '@/api/types'

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard.root,
    queryFn: ({ signal }) =>
      apiClient.get<LeaderboardResponse>('/api/leaderboard', signal),
  })
}
