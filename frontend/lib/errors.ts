import { ApiError } from '@/api/client'

/**
 * Pull a friendly error message out of whatever a query/mutation rejects with.
 */
export function extractApiError(err: unknown): string | null {
  if (!err) return null
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong'
}
