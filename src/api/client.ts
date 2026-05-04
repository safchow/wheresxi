import { readToken } from '@/api/tokenStorage'
import type { ApiErrorBody } from '@/api/types'

const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env
      ?.VITE_API_BASE_URL) ||
  'http://localhost:3333'

/**
 * Lightweight error type that surfaces the backend's `{ error: { code, message } }`
 * envelope. `message` is the human-readable string our UI renders.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errors?: unknown

  constructor(message: string, status: number, code: string, errors?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * Single fetch helper. Adds the bearer token when present, sends/receives JSON,
 * and converts non-2xx responses into a typed ApiError.
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  const token = readToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 204) return undefined as T

  let payload: unknown = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      // Non-JSON body. We'll fall through to the generic error path.
    }
  }

  if (!res.ok) {
    const env = payload as Partial<ApiErrorBody> | null
    const err = env?.error
    throw new ApiError(
      err?.message ?? `Request failed with ${res.status}`,
      res.status,
      err?.code ?? 'E_HTTP_ERROR',
      err?.errors,
    )
  }

  return payload as T
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
}
