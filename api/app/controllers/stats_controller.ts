import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StatsService from '#services/stats_service'

@inject()
export default class StatsController {
  constructor(private stats: StatsService) {}

  /** GET /api/stats/taylor */
  async taylor(ctx: HttpContext) {
    const stats = await this.stats.getTaylorStats()
    return ctx.response.ok(stats)
  }
}
