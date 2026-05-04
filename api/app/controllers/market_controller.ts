import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import MarketService, { type Granularity } from '#services/market_service'
import ApiException from '#exceptions/api_exception'

const GRANULARITIES: Granularity[] = [
  'HALF_HOUR',
  'QUARTER_HOUR',
  'FIVE_MIN',
  'EXACT',
]

@inject()
export default class MarketController {
  constructor(private market: MarketService) {}

  /**
   * GET /api/market/week?granularity=HALF_HOUR
   * Returns the three Tue/Wed/Thu markets for the current betting week,
   * each with its bucket grid (live guess counts) and total guesses.
   */
  async week(ctx: HttpContext) {
    const granularity = this.parseGranularity(ctx)
    const markets = await this.market.listActiveWeek()
    const results = await Promise.all(
      markets.map(async (m) => {
        const buckets = await this.market.buildBuckets(granularity, m.id)
        const totalGuesses = await this.market.totalGuessesFor(m.id)
        const lockedAt = MarketService.lockTimeFor(m.date).toISOString()
        const locked = MarketService.isLocked(m)
        return {
          market: { ...m, locked, lockedAt },
          granularity,
          buckets,
          totalGuesses,
        }
      }),
    )
    return ctx.response.ok({ markets: results })
  }

  /**
   * GET /api/market/:id/exact-minute?minute=615
   * Live count of guesses placed at this exact minute for one market.
   */
  async exactMinute(ctx: HttpContext) {
    const id = ctx.params.id as string
    const minute = Number(ctx.request.input('minute'))
    if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
      throw new ApiException('minute must be 0–1440', { status: 422 })
    }
    const market = await this.market.findById(id)
    if (!market) throw new ApiException('Market not found', { status: 404 })
    const guesses = await this.market.guessesAtExactMinute(market.id, minute)
    return ctx.response.ok({ minute, guesses })
  }

  private parseGranularity(ctx: HttpContext): Granularity {
    const raw = (ctx.request.input('granularity') ?? 'HALF_HOUR') as string
    if (!GRANULARITIES.includes(raw as Granularity)) {
      throw new ApiException(`Unknown granularity: ${raw}`, { status: 422 })
    }
    return raw as Granularity
  }
}
