import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import {
  useAllWeekMarkets,
  useExactMinuteGuesses,
  useWeekMarkets,
} from '@/client/queries'
import { createHarness } from '../../helpers/queryHarness'

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
  mockedApiClient.get.mockResolvedValue({ markets: [] })
})

describe('market query hooks', () => {
  it('fetches a week market for the requested granularity', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useWeekMarkets('EXACT'), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/market/week?granularity=EXACT',
        expect.any(AbortSignal),
      ),
    )
  })

  it('warms every week market granularity in parallel', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useAllWeekMarkets('FIVE_MIN'), { wrapper })

    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledTimes(4))
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/api/market/week?granularity=HALF_HOUR',
      expect.any(AbortSignal),
    )
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/api/market/week?granularity=QUARTER_HOUR',
      expect.any(AbortSignal),
    )
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/api/market/week?granularity=FIVE_MIN',
      expect.any(AbortSignal),
    )
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/api/market/week?granularity=EXACT',
      expect.any(AbortSignal),
    )
  })

  it('fetches exact-minute guesses only when a market day is selected', async () => {
    const { wrapper } = createHarness()

    const rendered = renderHook(
      ({ marketDayId }) => useExactMinuteGuesses(marketDayId, 615),
      {
        wrapper,
        initialProps: { marketDayId: null as string | null },
      },
    )

    expect(mockedApiClient.get).not.toHaveBeenCalled()

    rendered.rerender({ marketDayId: 'market-1' })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/market/market-1/exact-minute?minute=615',
        expect.any(AbortSignal),
      ),
    )
  })
})
