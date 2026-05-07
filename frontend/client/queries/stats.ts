import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/client/client'
import { queryKeys } from '@/client/queryKeys'
import type { TaylorStats } from '@/client/types'

export function useTaylorStats() {
  return useQuery({
    queryKey: queryKeys.stats.taylor,
    queryFn: ({ signal }) =>
      apiClient.get<TaylorStats>('/api/stats/taylor', signal),
  })
}
