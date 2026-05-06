import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AuthService from '#services/auth_service'
import { loginValidator, signupValidator } from '#validators/auth'
import ApiException from '#exceptions/api_exception'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

  /** POST /api/auth/signup */
  async signup(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(signupValidator)
    const result = await this.authService.signupWithInvite(payload)
    return ctx.response.created(this.serialize(result))
  }

  /** POST /api/auth/login */
  async login(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(loginValidator)
    const result = await this.authService.login(payload)
    return ctx.response.ok(this.serialize(result))
  }

  /** GET /api/auth/me — auth-protected via middleware */
  async me(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) {
      throw new ApiException('Authentication required', { status: 401 })
    }
    return ctx.response.ok({ user: this.authService.toPublicUser(user) })
  }

  /** POST /api/auth/logout */
  async logout(ctx: HttpContext) {
    const header = ctx.request.header('authorization') ?? ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    if (match) {
      const token = match[1].trim()
      await this.authService.logout(AuthService.hashToken(token))
    }
    return ctx.response.ok({ ok: true })
  }

  private serialize(result: {
    user: ReturnType<AuthService['toPublicUser']>
    token: string
    expiresAt: Date | null
  }) {
    return {
      user: result.user,
      token: result.token,
      expiresAt: result.expiresAt,
    }
  }
}
