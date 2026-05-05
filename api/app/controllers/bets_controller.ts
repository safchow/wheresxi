import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import BetService from '#services/bet_service'
import { placeBetValidator } from '#validators/bet'
import ApiException from '#exceptions/api_exception'

@inject()
export default class BetsController {
  constructor(private betService: BetService) {}

  /** POST /api/bets — place a guess on the supplied market day */
  async store(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const payload = await ctx.request.validateUsing(placeBetValidator)
    const bet = await this.betService.placeBet({
      userId: user.id,
      ...payload,
    })
    return ctx.response.created({ bet })
  }

  /** GET /api/bets/me */
  async mine(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const bets = await this.betService.listMyBets(user.id, 100)
    return ctx.response.ok({ bets })
  }

  /** DELETE /api/bets/:id — cancel a still-pending bet on an open market */
  async cancel(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const id = ctx.params.id as string
    const bet = await this.betService.cancelBet({ userId: user.id, betId: id })
    return ctx.response.ok({ bet })
  }

  /** POST /api/bankruptcy — reset to 500 cr if you're broke */
  async bankruptcy(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const result = await this.betService.declareBankruptcy(user.id)
    return ctx.response.ok({ credits: result.credits })
  }
}
