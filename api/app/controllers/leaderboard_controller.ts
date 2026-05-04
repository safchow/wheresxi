import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import LeaderboardService, {
  type LeaderboardRange,
} from '#services/leaderboard_service'

@inject()
export default class LeaderboardController {
  constructor(private leaderboard: LeaderboardService) {}

  /** GET /api/leaderboard?range=today|week|all */
  async index(ctx: HttpContext) {
    const raw = (ctx.request.input('range') ?? 'week') as string
    const range: LeaderboardRange =
      raw === 'today' || raw === 'all' ? raw : 'week'
    const rows = await this.leaderboard.listTop(range, 50)
    return ctx.response.ok({ range, rows })
  }
}
