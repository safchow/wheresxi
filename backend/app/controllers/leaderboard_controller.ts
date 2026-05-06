import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import LeaderboardService from '#services/leaderboard_service'

@inject()
export default class LeaderboardController {
  constructor(private leaderboard: LeaderboardService) {}

  /** GET /api/leaderboard */
  async index(ctx: HttpContext) {
    const rows = await this.leaderboard.listTop(50)
    return ctx.response.ok({ rows })
  }
}
