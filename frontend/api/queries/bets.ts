import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Bet, PlaceBetInput } from '@/api/types'

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
