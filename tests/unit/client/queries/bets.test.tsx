import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import {
  queryKeys,
  useCancelBet,
  useDeclareBankruptcy,
  useMyBets,
  usePlaceBet,
} from '@/client/queries'
import type { PlaceBetInput } from '@/client/types'
import { createHarness, runMutation } from '../../helpers/queryHarness'

vi.mock('@/client/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedApiClient = vi.mocked(apiClient)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApiClient.get.mockResolvedValue({ bets: [] })
  mockedApiClient.post.mockResolvedValue({})
  mockedApiClient.delete.mockResolvedValue({})
})

describe('bet query hooks', () => {
  it('fetches the signed-in user bet list', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useMyBets(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/bets/me',
        expect.any(AbortSignal),
      ),
    )
  })

  it('posts bet placements and refreshes dependent data', async () => {
    const input: PlaceBetInput = {
      marketDayId: 'market-1',
      granularity: 'HALF_HOUR',
      bucketStartMinute: 540,
      bucketEndMinute: 570,
      wager: 25,
    }

    const { invalidateSpy } = await runMutation(usePlaceBet, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/bets', input)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.market.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bets.root })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.leaderboard.root,
    })
  })

  it('deletes cancelled bets and refreshes dependent data', async () => {
    const { invalidateSpy } = await runMutation(useCancelBet, 'bet-1')

    expect(mockedApiClient.delete).toHaveBeenCalledWith('/api/bets/bet-1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.market.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bets.root })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.leaderboard.root,
    })
  })

  it('posts bankruptcy declarations and refreshes user standings', async () => {
    const { invalidateSpy } = await runMutation(useDeclareBankruptcy, undefined)

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/bankruptcy')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.leaderboard.root,
    })
  })
})
