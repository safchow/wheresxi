import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { TaylorStats } from '@/api/types'

export function useTaylorStats() {
  return useQuery({
    queryKey: queryKeys.stats.taylor,
    queryFn: ({ signal }) =>
      apiClient.get<TaylorStats>('/api/stats/taylor', signal),
  })
}
