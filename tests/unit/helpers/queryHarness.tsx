import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

/**
 * Build an isolated QueryClient + provider wrapper for hook tests. Retries are
 * disabled so failed mock calls fail fast.
 */
export function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { queryClient, wrapper }
}

/**
 * Run a mutation hook end-to-end and return the spy on `invalidateQueries` so
 * tests can assert which cache prefixes were invalidated by `onSuccess`.
 */
export async function runMutation<TInput>(
  useHook: () => { mutateAsync: (input: TInput) => Promise<unknown> },
  input: TInput,
) {
  const harness = createHarness()
  const invalidateSpy = vi.spyOn(harness.queryClient, 'invalidateQueries')
  const rendered = renderHook(() => useHook(), { wrapper: harness.wrapper })

  await act(async () => {
    await rendered.result.current.mutateAsync(input)
  })

  return { invalidateSpy }
}
