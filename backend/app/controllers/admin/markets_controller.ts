import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { PrismaClient } from '@prisma/client'
import AuditService from '#services/audit_service'
import BetService from '#services/bet_service'
import MarketService from '#services/market_service'
import {
  refundMarketValidator,
  resolveMarketValidator,
} from '#validators/bet'
import ApiException from '#exceptions/api_exception'

@inject()
export default class AdminMarketsController {
  constructor(
    private prisma: PrismaClient,
    private market: MarketService,
    private betService: BetService,
    private audit: AuditService,
  ) {}

  /** GET /api/admin/markets — recent markets */
  async index(ctx: HttpContext) {
    const markets = await this.market.listRecent(60)
    return ctx.response.ok({ markets })
  }

  /** GET /api/admin/markets/:id/bets — bets for a market with usernames */
  async bets(ctx: HttpContext) {
    const id = ctx.params.id as string
    const bets = await this.betService.listForMarket(id, 500)
    return ctx.response.ok({ bets })
  }

  /**
   * POST /api/admin/markets/resolve
   * Body: { date, arrivedAtMinute? | bustReason? }
   * Exactly one of arrivedAtMinute / bustReason must be provided.
   */
  async resolve(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const payload = await ctx.request.validateUsing(resolveMarketValidator)

    const arrived = payload.arrivedAtMinute
    const bust = payload.bustReason
    if ((arrived == null && !bust) || (arrived != null && bust)) {
      throw new ApiException(
        'Provide exactly one of arrivedAtMinute or bustReason',
        { status: 422, code: 'E_BAD_RESOLVE' },
      )
    }

    const market = await this.upsertMarketForDate(payload.date)

    const result =
      arrived != null
        ? await this.betService.resolveMarket(market.id, {
            kind: 'arrived',
            arrivedAtMinute: arrived,
            resolvedById: user.id,
          })
        : await this.betService.resolveMarket(market.id, {
            kind: 'bust',
            reason: bust!,
            resolvedById: user.id,
          })

    await this.audit.log({
      adminId: user.id,
      action: 'RESOLVE_MARKET',
      targetType: 'MarketDay',
      targetId: market.id,
      payload: {
        date: payload.date,
        arrivedAtMinute: arrived ?? null,
        bustReason: bust ?? null,
        settled: result.settled,
      },
    })

    return ctx.response.ok(result)
  }

  /**
   * POST /api/admin/markets/refund
   * Body: { date }
   * Voids the market: refunds every PENDING bet, marks status REFUNDED.
   */
  async refund(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const payload = await ctx.request.validateUsing(refundMarketValidator)
    const market = await this.upsertMarketForDate(payload.date)
    const result = await this.betService.refundMarket(market.id, user.id)
    await this.audit.log({
      adminId: user.id,
      action: 'REFUND_MARKET',
      targetType: 'MarketDay',
      targetId: market.id,
      payload: {
        date: payload.date,
        refundedCount: result.refundedCount,
        refundTotal: result.refundTotal,
      },
    })
    return ctx.response.ok(result)
  }

  private async upsertMarketForDate(input: string) {
    const date = MarketService.dateOnly(input)
    return this.prisma.marketDay.upsert({
      where: { date },
      update: {},
      create: { date, status: 'OPEN' },
    })
  }
}
