import { inject } from '@adonisjs/core'
import { PrismaClient } from '@prisma/client'

export type LeaderboardRange = 'today' | 'week' | 'all'

export type LeaderboardRow = {
  rank: number
  userId: string
  username: string
  name: string
  credits: number
  bankruptcies: number
  bets: number
  won: number
  lost: number
  pending: number
  // accuracy = won / settled (won + lost), as a percentage (0–100). null if 0 settled.
  accuracy: number | null
  biggestWin: number
  biggestWinAt: Date | null
}

@inject()
export default class LeaderboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Top N players plus aggregated stats. The range filters which bets
   * contribute to bets/won/lost/accuracy/biggestWin counts; credits and
   * bankruptcies are always lifetime since they're cumulative state.
   */
  async listTop(range: LeaderboardRange, limit = 50): Promise<LeaderboardRow[]> {
    const since = LeaderboardService.rangeStart(range)
    const users = await this.prisma.user.findMany({
      orderBy: { credits: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        name: true,
        credits: true,
        bankruptcies: true,
      },
    })

    if (users.length === 0) return []
    const userIds = users.map((u) => u.id)

    // One trip to the DB to pull every bet stat we need, grouped by status.
    const grouped = await this.prisma.bet.groupBy({
      by: ['userId', 'status'],
      where: {
        userId: { in: userIds },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _count: { _all: true },
      _max: { payout: true, settledAt: true },
    })

    type Stats = {
      bets: number
      won: number
      lost: number
      pending: number
      biggestWin: number
      biggestWinAt: Date | null
    }
    const blank = (): Stats => ({
      bets: 0,
      won: 0,
      lost: 0,
      pending: 0,
      biggestWin: 0,
      biggestWinAt: null,
    })
    const byUser = new Map<string, Stats>()
    for (const row of grouped) {
      const stats = byUser.get(row.userId) ?? blank()
      const count = row._count._all
      stats.bets += count
      if (row.status === 'WON') {
        stats.won = count
        if ((row._max.payout ?? 0) > stats.biggestWin) {
          stats.biggestWin = row._max.payout ?? 0
          stats.biggestWinAt = row._max.settledAt ?? null
        }
      } else if (row.status === 'LOST') {
        stats.lost = count
      } else {
        stats.pending = count
      }
      byUser.set(row.userId, stats)
    }

    return users.map((u, idx) => {
      const s = byUser.get(u.id) ?? blank()
      const settled = s.won + s.lost
      const accuracy = settled === 0 ? null : Math.round((s.won / settled) * 100)
      return {
        rank: idx + 1,
        userId: u.id,
        username: u.username,
        name: u.name,
        credits: u.credits,
        bankruptcies: u.bankruptcies,
        bets: s.bets,
        won: s.won,
        lost: s.lost,
        pending: s.pending,
        accuracy,
        biggestWin: s.biggestWin,
        biggestWinAt: s.biggestWinAt,
      }
    })
  }

  static rangeStart(range: LeaderboardRange): Date | null {
    const now = new Date()
    if (range === 'all') return null
    if (range === 'today') {
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      )
    }
    // week — last 7 days rolling
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - 7)
    return d
  }
}
