import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import {
  queryKeys,
  useAdminInvites,
  useAdminMarketBets,
  useAdminMarkets,
  useAdminRefundMarket,
  useAdminResolveMarket,
  useCreateInvite,
  useRevokeInvite,
} from '@/client/queries'
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
  mockedApiClient.get.mockResolvedValue({})
  mockedApiClient.post.mockResolvedValue({})
  mockedApiClient.delete.mockResolvedValue({})
})

describe('admin query hooks', () => {
  it('fetches admin markets', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useAdminMarkets(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/markets',
        expect.any(AbortSignal),
      ),
    )
  })

  it('fetches bets for the selected admin market', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useAdminMarketBets('market-1'), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/markets/market-1/bets',
        expect.any(AbortSignal),
      ),
    )
  })

  it('does not fetch admin market bets when disabled', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useAdminMarketBets('market-1', false), { wrapper })

    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('posts market resolutions and refreshes affected views', async () => {
    const input = { date: '2026-05-06', arrivedAtMinute: 600 }

    const { invalidateSpy } = await runMutation(useAdminResolveMarket, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/markets/resolve',
      input,
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.markets,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.market.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bets.root })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.leaderboard.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.stats.taylor,
    })
  })

  it('posts market refunds and refreshes affected views', async () => {
    const input = { date: '2026-05-06' }

    const { invalidateSpy } = await runMutation(useAdminRefundMarket, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/markets/refund',
      input,
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.markets,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.market.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bets.root })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.leaderboard.root,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.stats.taylor,
    })
  })

  it('fetches admin invites', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useAdminInvites(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/invites',
        expect.any(AbortSignal),
      ),
    )
  })

  it('posts invite creation payloads and refreshes invite state', async () => {
    const input = { expiresInDays: 7, note: 'office pool', grantsRole: 'USER' }

    const { invalidateSpy } = await runMutation(useCreateInvite, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/admin/invites',
      input,
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.invites,
    })
  })

  it('deletes revoked invites and refreshes invite state', async () => {
    const { invalidateSpy } = await runMutation(useRevokeInvite, 'invite-1')

    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/api/admin/invites/invite-1',
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.invites,
    })
  })
})
