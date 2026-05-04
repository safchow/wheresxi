import { inject } from '@adonisjs/core'
import {
  PrismaClient,
  type Bet,
  type BustReason,
  type Granularity,
  type MarketDay,
} from '@prisma/client'
import ApiException from '#exceptions/api_exception'
import MarketService, {
  MULTIPLIERS,
  STEP_FOR_GRANULARITY,
  WINDOW_END_MINUTES,
  WINDOW_START_MINUTES,
} from '#services/market_service'

export type PlaceBetInput = {
  userId: string
  marketDayId: string
  granularity: Granularity
  bucketStartMinute?: number
  bucketEndMinute?: number
  exactMinute?: number
  wager: number
}

export type ResolveMarketInput =
  | { kind: 'arrived'; arrivedAtMinute: number; resolvedById: string }
  | { kind: 'bust'; reason: BustReason; resolvedById: string }

export type RefundMarketResult = {
  market: import('@prisma/client').MarketDay
  refundedCount: number
  refundTotal: number
}

@inject()
export default class BetService {
  constructor(private prisma: PrismaClient) {}

  // ─── place bet ─────────────────────────────────────────────────────────

  async placeBet(input: PlaceBetInput): Promise<Bet> {
    if (!Number.isInteger(input.wager) || input.wager < 1) {
      throw new ApiException('Wager must be a positive whole number', {
        status: 422,
        code: 'E_BAD_WAGER',
      })
    }

    const multiplier = MULTIPLIERS[input.granularity]

    // Validate bucket coordinates per granularity.
    if (input.granularity === 'EXACT') {
      if (
        input.exactMinute === undefined ||
        !Number.isInteger(input.exactMinute) ||
        input.exactMinute < WINDOW_START_MINUTES ||
        input.exactMinute >= WINDOW_END_MINUTES
      ) {
        throw new ApiException(
          'exactMinute must be within the arrival window',
          { status: 422, code: 'E_BAD_BUCKET' },
        )
      }
    } else {
      const step =
        STEP_FOR_GRANULARITY[
          input.granularity as Exclude<Granularity, 'EXACT'>
        ]
      const start = input.bucketStartMinute
      const end = input.bucketEndMinute
      if (
        start === undefined ||
        end === undefined ||
        end - start !== step ||
        start < WINDOW_START_MINUTES ||
        end > WINDOW_END_MINUTES ||
        (start - WINDOW_START_MINUTES) % step !== 0
      ) {
        throw new ApiException('Bucket does not match the granularity grid', {
          status: 422,
          code: 'E_BAD_BUCKET',
        })
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const market = await tx.marketDay.findUnique({
        where: { id: input.marketDayId },
      })
      if (!market) {
        throw new ApiException('Market not found', { status: 404 })
      }
      if (market.status !== 'OPEN') {
        throw new ApiException('Market is no longer open for guesses', {
          status: 409,
          code: 'E_MARKET_CLOSED',
        })
      }
      if (MarketService.isLocked(market)) {
        throw new ApiException('Market has locked for guesses', {
          status: 409,
          code: 'E_MARKET_LOCKED',
        })
      }

      const user = await tx.user.findUnique({ where: { id: input.userId } })
      if (!user) throw new ApiException('User not found', { status: 404 })
      if (user.credits < input.wager) {
        throw new ApiException('Not enough credits', {
          status: 422,
          code: 'E_INSUFFICIENT_CREDITS',
        })
      }

      // Debit the wager up front so it's locked while the market is open.
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: input.wager } },
      })

      const bet = await tx.bet.create({
        data: {
          userId: input.userId,
          marketDayId: input.marketDayId,
          granularity: input.granularity,
          bucketStartMinute: input.bucketStartMinute ?? null,
          bucketEndMinute: input.bucketEndMinute ?? null,
          exactMinute: input.exactMinute ?? null,
          wager: input.wager,
          multiplier,
        },
      })
      return bet
    })
  }

  // ─── cancel ────────────────────────────────────────────────────────────

  /**
   * Cancel a bet that hasn't been settled yet. Refunds the wager and marks
   * the bet CANCELLED. Caller must own the bet, the bet must be PENDING,
   * and the market must still be OPEN.
   */
  async cancelBet(input: { userId: string; betId: string }): Promise<Bet> {
    return this.prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findUnique({
        where: { id: input.betId },
        include: { marketDay: true },
      })
      if (!bet) throw new ApiException('Bet not found', { status: 404 })
      if (bet.userId !== input.userId) {
        throw new ApiException('Forbidden', { status: 403, code: 'E_FORBIDDEN' })
      }
      if (bet.status !== 'PENDING') {
        throw new ApiException(
          'Bet has already been settled — too late to cancel',
          { status: 409, code: 'E_BET_SETTLED' },
        )
      }
      if (bet.marketDay.status !== 'OPEN') {
        throw new ApiException('Market is closed — cannot cancel now', {
          status: 409,
          code: 'E_MARKET_CLOSED',
        })
      }
      if (MarketService.isLocked(bet.marketDay)) {
        throw new ApiException(
          'Market has locked — cannot cancel after the deadline',
          { status: 409, code: 'E_MARKET_LOCKED' },
        )
      }

      await tx.user.update({
        where: { id: bet.userId },
        data: { credits: { increment: bet.wager } },
      })

      const cancelled = await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: 'CANCELLED',
          payout: bet.wager,
          settledAt: new Date(),
        },
      })
      return cancelled
    })
  }

  // ─── reads ─────────────────────────────────────────────────────────────

  async listMyBets(userId: string, limit = 100): Promise<Bet[]> {
    return this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { marketDay: true },
    })
  }

  async listForMarket(
    marketDayId: string,
    limit = 200,
  ): Promise<Array<Bet & { user: { id: string; username: string } }>> {
    return this.prisma.bet.findMany({
      where: { marketDayId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true } },
      },
    })
  }

  // ─── resolution ────────────────────────────────────────────────────────

  /**
   * Resolve a market day, transitioning every PENDING bet to WON/LOST and
   * crediting payouts. Idempotent: throws if the market is already RESOLVED.
   *
   * Bust scenarios (everyone busts):
   *   - kind === 'bust'
   *
   * Otherwise, we have an arrival minute, and we evaluate per bet:
   *   - EXACT: arrivalMinute === exactMinute → WON
   *   - others: bucketStart <= arrivalMinute < bucketEnd → WON
   */
  async resolveMarket(
    marketDayId: string,
    input: ResolveMarketInput,
  ): Promise<{
    market: MarketDay
    settled: { won: number; lost: number; payoutTotal: number }
  }> {
    if (input.kind === 'arrived') {
      if (
        !Number.isInteger(input.arrivedAtMinute) ||
        input.arrivedAtMinute < WINDOW_START_MINUTES ||
        input.arrivedAtMinute >= WINDOW_END_MINUTES
      ) {
        throw new ApiException(
          `Arrival minute must be within ${WINDOW_START_MINUTES}-${WINDOW_END_MINUTES - 1}`,
          { status: 422, code: 'E_BAD_ARRIVAL' },
        )
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const market = await tx.marketDay.findUnique({
        where: { id: marketDayId },
      })
      if (!market) {
        throw new ApiException('Market not found', { status: 404 })
      }
      if (market.status === 'RESOLVED' || market.status === 'REFUNDED') {
        throw new ApiException('Market has already been settled', {
          status: 409,
          code: 'E_MARKET_RESOLVED',
        })
      }

      const pendingBets = await tx.bet.findMany({
        where: { marketDayId, status: 'PENDING' },
      })

      let won = 0
      let lost = 0
      let payoutTotal = 0
      const now = new Date()

      const isBust = input.kind === 'bust'
      const arrivalMinute =
        input.kind === 'arrived' ? input.arrivedAtMinute : null

      for (const bet of pendingBets) {
        let didWin = false
        if (!isBust) {
          if (bet.granularity === 'EXACT') {
            didWin = bet.exactMinute === arrivalMinute
          } else if (
            bet.bucketStartMinute !== null &&
            bet.bucketEndMinute !== null &&
            arrivalMinute !== null
          ) {
            didWin =
              arrivalMinute >= bet.bucketStartMinute &&
              arrivalMinute < bet.bucketEndMinute
          }
        }

        if (didWin) {
          const payout = bet.wager * bet.multiplier
          await tx.bet.update({
            where: { id: bet.id },
            data: { status: 'WON', payout, settledAt: now },
          })
          await tx.user.update({
            where: { id: bet.userId },
            data: { credits: { increment: payout } },
          })
          won++
          payoutTotal += payout
        } else {
          await tx.bet.update({
            where: { id: bet.id },
            data: { status: 'LOST', payout: 0, settledAt: now },
          })
          lost++
        }
      }

      const updatedMarket = await tx.marketDay.update({
        where: { id: marketDayId },
        data: {
          status: 'RESOLVED',
          arrivedAtMinute: input.kind === 'arrived' ? input.arrivedAtMinute : null,
          bustReason: input.kind === 'bust' ? input.reason : null,
          resolvedAt: now,
          resolvedById: input.resolvedById,
        },
      })

      return { market: updatedMarket, settled: { won, lost, payoutTotal } }
    })
  }

  // ─── refund ────────────────────────────────────────────────────────────

  /**
   * Void a market: every PENDING bet is marked REFUNDED, and the user gets
   * their wager credited back. Used as an admin escape hatch (holiday,
   * Taylor unreachable, weather-cancelled office, etc.).
   *
   * Idempotent guard: throws if the market has already been resolved or
   * refunded.
   */
  async refundMarket(
    marketDayId: string,
    resolvedById: string,
  ): Promise<RefundMarketResult> {
    return this.prisma.$transaction(async (tx) => {
      const market = await tx.marketDay.findUnique({
        where: { id: marketDayId },
      })
      if (!market) throw new ApiException('Market not found', { status: 404 })
      if (market.status === 'RESOLVED' || market.status === 'REFUNDED') {
        throw new ApiException('Market has already been settled', {
          status: 409,
          code: 'E_MARKET_RESOLVED',
        })
      }

      const pending = await tx.bet.findMany({
        where: { marketDayId, status: 'PENDING' },
      })

      const now = new Date()
      let refundTotal = 0
      for (const bet of pending) {
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: 'REFUNDED',
            payout: bet.wager,
            settledAt: now,
          },
        })
        await tx.user.update({
          where: { id: bet.userId },
          data: { credits: { increment: bet.wager } },
        })
        refundTotal += bet.wager
      }

      const updated = await tx.marketDay.update({
        where: { id: marketDayId },
        data: {
          status: 'REFUNDED',
          arrivedAtMinute: null,
          bustReason: null,
          resolvedAt: now,
          resolvedById,
        },
      })
      return { market: updated, refundedCount: pending.length, refundTotal }
    })
  }

  // ─── bankruptcy ────────────────────────────────────────────────────────

  async declareBankruptcy(userId: string): Promise<{ credits: number }> {
    const resetTo = Number(process.env.BANKRUPTCY_RESET_CREDITS ?? 100)
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user) throw new ApiException('User not found', { status: 404 })
      if (user.credits > 0) {
        throw new ApiException(
          'You still have credits. File when you actually run out.',
          { status: 409, code: 'E_TOO_RICH_TO_BUST' },
        )
      }
      await tx.bankruptcyEvent.create({
        data: { userId, atCredits: user.credits, resetTo },
      })
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          credits: resetTo,
          bankruptcies: { increment: 1 },
        },
      })
      return { credits: updated.credits }
    })
  }
}
