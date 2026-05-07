import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import { useTaylorStats } from '@/client/queries'
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
  mockedApiClient.get.mockResolvedValue({})
})

describe('stats query hooks', () => {
  it('fetches Taylor stats', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useTaylorStats(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/stats/taylor',
        expect.any(AbortSignal),
      ),
    )
  })
})
