import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import ApiException from '#exceptions/api_exception'

interface JsonError {
  status: number
  code: string
  message: string
  errors?: unknown
}

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    const payload = this.toJsonError(error)
    if (payload) {
      ctx.response.status(payload.status)
      return ctx.response.send({
        error: {
          code: payload.code,
          message: payload.message,
          ...(payload.errors ? { errors: payload.errors } : {}),
        },
      })
    }
    return super.handle(error, ctx)
  }

  protected toJsonError(error: unknown): JsonError | null {
    if (error instanceof ApiException) {
      return {
        status: error.status,
        code: error.code ?? 'E_API_ERROR',
        message: error.message,
      }
    }
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return {
        status: 422,
        code: 'E_VALIDATION_ERROR',
        message: 'Invalid request',
        errors: (error as unknown as { messages: unknown }).messages,
      }
    }
    return null
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
