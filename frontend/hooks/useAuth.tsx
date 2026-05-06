import { useQueryClient } from '@tanstack/react-query'
import {
  queryKeys,
  useLogin,
  useLogout,
  useMe,
  useSignup,
} from '@/api/queries'
import { readToken, writeToken } from '@/api/tokenStorage'
import type { PublicUser } from '@/api/types'

/**
 * App-wide auth hook backed by TanStack Query. The bearer token lives in
 * localStorage; when present we run the `/api/auth/me` query, and that
 * shared cache entry is the source of truth for who the user is.
 *
 * No context/provider needed — every component that calls `useAuth()` shares
 * the same React Query subscription via the query key.
 */
export type AuthState = {
  user: PublicUser | null
  isLoggedIn: boolean
  isLoading: boolean
  isAdmin: boolean
  login: (input: { username: string; password: string }) => Promise<void>
  signup: (input: {
    inviteToken: string
    username: string
    name: string
    password: string
  }) => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient()
  const hasToken = !!readToken()
  const meQuery = useMe()
  const loginMutation = useLogin()
  const signupMutation = useSignup()
  const logoutMutation = useLogout()

  const user = meQuery.data?.user ?? null

  return {
    user,
    isLoggedIn: !!user,
    isLoading: hasToken && (meQuery.isLoading || meQuery.isFetching) && !user,
    isAdmin: user?.role === 'ADMIN',
    login: async (input) => {
      const res = await loginMutation.mutateAsync(input)
      writeToken(res.token)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
    signup: async (input) => {
      const res = await signupMutation.mutateAsync(input)
      writeToken(res.token)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
    logout: async () => {
      try {
        await logoutMutation.mutateAsync()
      } catch {
        /* even if it fails server-side, drop the token client-side */
      }
      writeToken(null)
      queryClient.clear()
    },
  }
}
