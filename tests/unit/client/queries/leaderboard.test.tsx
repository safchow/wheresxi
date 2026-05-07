import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import { useLeaderboard } from '@/client/queries'
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
  mockedApiClient.get.mockResolvedValue({ rows: [] })
})

describe('leaderboard query hooks', () => {
  it('fetches leaderboard rows', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useLeaderboard(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/leaderboard',
        expect.any(AbortSignal),
      ),
    )
  })
})
