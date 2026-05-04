import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Role } from '@prisma/client'
import ApiException from '#exceptions/api_exception'

/**
 * Gates a route on a user role. Must run after AuthMiddleware so
 * `ctx.currentUser` is populated.
 *
 * Usage:
 *   router.post('/admin/x', ...).use([
 *     middleware.auth(),
 *     middleware.role({ role: 'ADMIN' }),
 *   ])
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { role: Role }) {
    const user = ctx.currentUser
    if (!user) {
      throw new ApiException('Authentication required', {
        status: 401,
        code: 'E_UNAUTHENTICATED',
      })
    }
    if (user.role !== options.role) {
      throw new ApiException('Forbidden', {
        status: 403,
        code: 'E_FORBIDDEN',
      })
    }
    return next()
  }
}
