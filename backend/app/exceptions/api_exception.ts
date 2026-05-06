import { Exception } from '@adonisjs/core/exceptions'

/**
 * Application-level error for predictable failure modes (validation, auth,
 * domain rules). Carries an HTTP status and an optional machine code.
 *
 * Throw from services. Caught by the global exception handler and turned
 * into a JSON response.
 */
export default class ApiException extends Exception {
  static status = 400
  static code = 'E_API_ERROR'

  declare readonly context?: Record<string, unknown>

  constructor(
    message: string,
    options?: {
      status?: number
      code?: string
      context?: Record<string, unknown>
    },
  ) {
    super(message, {
      status: options?.status ?? 400,
      code: options?.code ?? 'E_API_ERROR',
    })
    if (options?.context) {
      Object.defineProperty(this, 'context', {
        value: options.context,
        enumerable: false,
      })
    }
  }
}
