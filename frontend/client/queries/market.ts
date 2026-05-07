import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/client/client'
import { queryKeys } from '@/client/queryKeys'
import type { Granularity, WeekMarketsResponse } from '@/client/types'

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
        apiClient.get<WeekMarketsResponse>(
          `/api/market/week?granularity=${g}`,
          signal,
        ),
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
