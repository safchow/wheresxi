import { inject } from '@adonisjs/core'
import { PrismaClient, type BustReason } from '@prisma/client'
import MarketService from '#services/market_service'

export type RecentArrival =
  | { day: string; date: string; kind: 'wfh' }
  | { day: string; date: string; kind: 'pending' }
  | { day: string; date: string; kind: 'refunded' }
  | { day: string; date: string; kind: 'busted'; bustReason: BustReason }
  | { day: string; date: string; kind: 'arrived'; minute: number }

export type TaylorStats = {
  traderCount: number
  avgArrivalMinute: number | null
  arrivalSampleSize: number
  recentArrivals: RecentArrival[]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_OFFSETS = [1, 2, 3, 4, 5] // Mon..Fri

@inject()
export default class StatsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Aggregate stats for the Taylor dossier:
   *  - `traderCount`: how many real users have signed up (excluding the
   *    `system` bootstrap user)
   *  - `avgArrivalMinute`: arithmetic mean of every recorded arrival minute
   *    across all RESOLVED markets that ended with an actual arrival
   *  - `recentArrivals`: this week's Mon→Fri, with each day annotated as
   *    arrived / refunded / busted / pending / WFH
   */
  async getTaylorStats(): Promise<TaylorStats> {
    const traderCount = await this.prisma.user.count({
      where: { username: { not: 'system' } },
    })

    const arrivedMarkets = await this.prisma.marketDay.findMany({
      where: {
        status: 'RESOLVED',
        arrivedAtMinute: { not: null },
      },
      select: { arrivedAtMinute: true },
    })
    const minutes = arrivedMarkets
      .map((m) => m.arrivedAtMinute)
      .filter((x): x is number => typeof x === 'number')

    const avgArrivalMinute =
      minutes.length === 0
        ? null
        : Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)

    const recentArrivals = await this.computeRecentArrivals()

    return {
      traderCount,
      avgArrivalMinute,
      arrivalSampleSize: minutes.length,
      recentArrivals,
    }
  }

  private async computeRecentArrivals(): Promise<RecentArrival[]> {
    const today = MarketService.dateOnly(new Date())
    const weekStart = new Date(today)
    weekStart.setUTCDate(weekStart.getUTCDate() - today.getUTCDay()) // Sunday

    const weekDays = WEEKDAY_OFFSETS.map((offset) => {
      const d = new Date(weekStart)
      d.setUTCDate(d.getUTCDate() + offset)
      return d
    })

    const markets = await this.prisma.marketDay.findMany({
      where: { date: { in: weekDays } },
    })

    return weekDays.map((date) => {
      const dayName = DAY_NAMES[date.getUTCDay()]
      const isoDate = date.toISOString().slice(0, 10)
      const dayOfWeek = date.getUTCDay()

      // Mon (1) and Fri (5) — Taylor never comes in.
      if (dayOfWeek === 1 || dayOfWeek === 5) {
        return { day: dayName, date: isoDate, kind: 'wfh' }
      }

      const market = markets.find(
        (m) => new Date(m.date).getTime() === date.getTime(),
      )
      if (!market) {
        return { day: dayName, date: isoDate, kind: 'pending' }
      }
      if (market.status === 'REFUNDED') {
        return { day: dayName, date: isoDate, kind: 'refunded' }
      }
      if (market.status === 'RESOLVED') {
        if (market.arrivedAtMinute != null) {
          return {
            day: dayName,
            date: isoDate,
            kind: 'arrived',
            minute: market.arrivedAtMinute,
          }
        }
        if (market.bustReason) {
          return {
            day: dayName,
            date: isoDate,
            kind: 'busted',
            bustReason: market.bustReason,
          }
        }
      }
      return { day: dayName, date: isoDate, kind: 'pending' }
    })
  }
}
