import { inject } from '@adonisjs/core'
import { PrismaClient, type MarketDay } from '@prisma/client'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import env from '#start/env'

/**
 * The market window — Taylor never arrives outside this on a non-bust day.
 * Mirrored by the frontend (`src/lib/buckets.ts`).
 */
export const WINDOW_START_MINUTES = 9 * 60
export const WINDOW_END_MINUTES = 10 * 60 + 30 // exclusive

const DEFAULT_TZ = 'America/Toronto'
function officeTz(): string {
  return env.get('OFFICE_TIMEZONE', DEFAULT_TZ) || DEFAULT_TZ
}

export type Granularity = 'HALF_HOUR' | 'QUARTER_HOUR' | 'FIVE_MIN' | 'EXACT'

export const MULTIPLIERS: Record<Granularity, number> = {
  HALF_HOUR: 2,
  QUARTER_HOUR: 4,
  FIVE_MIN: 12,
  EXACT: 60,
}

export const STEP_FOR_GRANULARITY: Record<
  Exclude<Granularity, 'EXACT'>,
  number
> = {
  HALF_HOUR: 30,
  QUARTER_HOUR: 15,
  FIVE_MIN: 5,
}

export type Bucket = {
  id: string
  label: string
  startMinutes: number
  endMinutes: number
  guesses: number
}

@inject()
export default class MarketService {
  constructor(private prisma: PrismaClient) {}

  /** Calendar date at UTC midnight, useful as the unique key for MarketDay. */
  static dateOnly(d: Date | string): Date {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    )
  }

  static formatTime(minutes: number): string {
    const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const h24 = Math.floor(m / 60)
    const mm = m % 60
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${mm.toString().padStart(2, '0')}`
  }

  /**
   * The instant a market locks for new bets / cancellations: midnight at the
   * start of the market's calendar day in the configured office time zone.
   *
   * Example: Tuesday Apr 28's lock time is `2026-04-28 00:00 America/Toronto`,
   * which is `2026-04-28 04:00 UTC` during EDT.
   */
  static lockTimeFor(marketDate: Date | string, tz: string = officeTz()): Date {
    const date =
      typeof marketDate === 'string' ? new Date(marketDate) : marketDate
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    return fromZonedTime(`${yyyy}-${mm}-${dd}T00:00:00`, tz)
  }

  static isLocked(
    market: { date: Date | string; status: string },
    now: Date = new Date(),
  ): boolean {
    if (market.status === 'RESOLVED' || market.status === 'REFUNDED') {
      return true
    }
    return now.getTime() >= MarketService.lockTimeFor(market.date).getTime()
  }

  /**
   * The current "betting week" runs Sunday → Saturday in the office time
   * zone. On Sunday morning the week rolls over and a fresh set of
   * Tue/Wed/Thu markets becomes active. Returns the Tue/Wed/Thu calendar
   * dates of the current office-local week, in order.
   */
  static currentWeekMarketDates(now: Date = new Date()): Date[] {
    const tz = officeTz()
    const zonedNow = toZonedTime(now, tz)
    const dayOfWeek = zonedNow.getDay() // 0=Sun in office tz
    const yyyy = zonedNow.getFullYear()
    const mm = zonedNow.getMonth()
    const dd = zonedNow.getDate()
    return [2, 3, 4].map((offset) => {
      const day = dd + (offset - dayOfWeek)
      const local = new Date(yyyy, mm, day)
      // Store as UTC midnight of the office-local calendar day so the row
      // round-trips through Postgres' `@db.Date` cleanly.
      return new Date(
        Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
      )
    })
  }

  /**
   * Returns this week's three markets (Tue/Wed/Thu), creating any that don't
   * yet exist. Idempotent and concurrency-safe: the previous per-row upsert
   * loop raced under load (P2002 unique violation on `MarketDay.date` when
   * the dashboard fired multiple `GET /api/market/week` calls in parallel).
   *
   * `createMany({ skipDuplicates: true })` compiles to `INSERT ... ON
   * CONFLICT DO NOTHING` on Postgres, which is atomic, so concurrent callers
   * can each hit it without stepping on each other.
   */
  async listActiveWeek(): Promise<MarketDay[]> {
    const dates = MarketService.currentWeekMarketDates()
    await this.prisma.marketDay.createMany({
      data: dates.map((date) => ({ date, status: 'OPEN' as const })),
      skipDuplicates: true,
    })
    return this.prisma.marketDay.findMany({
      where: { date: { in: dates } },
      orderBy: { date: 'asc' },
    })
  }

  /** Most recent N markets, newest first. */
  async listRecent(limit = 10): Promise<MarketDay[]> {
    return this.prisma.marketDay.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    })
  }

  async findById(id: string): Promise<MarketDay | null> {
    return this.prisma.marketDay.findUnique({ where: { id } })
  }

  /**
   * Build the bucket grid for a given granularity and overlay live community
   * guess counts (from PENDING + WON + LOST bets) per bucket. Only bets
   * scoped to `marketDayId` are counted.
   */
  async buildBuckets(
    granularity: Granularity,
    marketDayId: string,
  ): Promise<Bucket[]> {
    if (granularity === 'EXACT') {
      // Exact-minute "buckets" aren't enumerated; the UI uses a minute picker.
      return []
    }
    const step = STEP_FOR_GRANULARITY[granularity]
    const buckets: Bucket[] = []
    for (let m = WINDOW_START_MINUTES; m < WINDOW_END_MINUTES; m += step) {
      buckets.push({
        id: `m-${m}-${step}`,
        label: `${MarketService.formatTime(m)} – ${MarketService.formatTime(
          m + step,
        )}`,
        startMinutes: m,
        endMinutes: m + step,
        guesses: 0,
      })
    }

    const counts = await this.prisma.bet.groupBy({
      by: ['bucketStartMinute', 'bucketEndMinute'],
      where: { marketDayId, granularity },
      _count: { _all: true },
    })
    const byKey = new Map<string, number>()
    for (const row of counts) {
      if (row.bucketStartMinute == null || row.bucketEndMinute == null) continue
      byKey.set(
        `${row.bucketStartMinute}-${row.bucketEndMinute}`,
        row._count._all,
      )
    }
    for (const b of buckets) {
      const k = `${b.startMinutes}-${b.endMinutes}`
      b.guesses = byKey.get(k) ?? 0
    }
    return buckets
  }

  /** Total guesses across all granularities + buckets for a market day. */
  async totalGuessesFor(marketDayId: string): Promise<number> {
    const result = await this.prisma.bet.count({ where: { marketDayId } })
    return result
  }

  async guessesAtExactMinute(
    marketDayId: string,
    exactMinute: number,
  ): Promise<number> {
    return this.prisma.bet.count({
      where: { marketDayId, granularity: 'EXACT', exactMinute },
    })
  }
}
