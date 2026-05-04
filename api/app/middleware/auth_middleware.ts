import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { User } from '@prisma/client'
import AuthService from '#services/auth_service'
import ApiException from '#exceptions/api_exception'

/**
 * Pulls the bearer token off the Authorization header, looks up the user, and
 * attaches them to `ctx`. Throws 401 if anything fails.
 *
 * Add a typed `currentUser` to `HttpContext` so controllers can access it
 * without `as`-casts.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    currentUser?: User
  }
}

export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization') ?? ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    if (!match) {
      throw new ApiException('Authentication required', {
        status: 401,
        code: 'E_UNAUTHENTICATED',
      })
    }
    const token = match[1].trim()
    const authService = await ctx.containerResolver.make(AuthService)
    const user = await authService.getUserByToken(token)
    if (!user) {
      throw new ApiException('Authentication required', {
        status: 401,
        code: 'E_UNAUTHENTICATED',
      })
    }
    ctx.currentUser = user
    return next()
  }
}
