import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/client/client'
import {
  queryKeys,
  useLogin,
  useLogout,
  useMe,
  useSignup,
} from '@/client/queries'
import { readToken } from '@/client/tokenStorage'
import { createHarness, runMutation } from '../../helpers/queryHarness'

vi.mock('@/client/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/client/tokenStorage', () => ({
  readToken: vi.fn(),
}))

const mockedApiClient = vi.mocked(apiClient)
const mockedReadToken = vi.mocked(readToken)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApiClient.get.mockResolvedValue({})
  mockedApiClient.post.mockResolvedValue({})
  mockedReadToken.mockReturnValue(null)
})

describe('auth query hooks', () => {
  it('does not fetch the current user without a stored token', async () => {
    const { wrapper } = createHarness()

    renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(mockedReadToken).toHaveBeenCalled())
    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('fetches the current user when a token exists', async () => {
    mockedReadToken.mockReturnValue('test-token')
    const { wrapper } = createHarness()

    renderHook(() => useMe(), { wrapper })

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.any(AbortSignal),
      ),
    )
  })

  it('posts login payloads and invalidates the current user', async () => {
    const input = { username: 'taylor', password: 'secret' }

    const { invalidateSpy } = await runMutation(useLogin, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/login', input)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
  })

  it('posts signup payloads and refreshes user and stats state', async () => {
    const input = {
      inviteToken: 'invite-123',
      username: 'taylor',
      name: 'Taylor',
      password: 'secret',
    }

    const { invalidateSpy } = await runMutation(useSignup, input)

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/signup', input)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.stats.taylor,
    })
  })

  it('posts logout requests without cache side effects', async () => {
    const { invalidateSpy } = await runMutation(useLogout, undefined)

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/logout')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
