import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createTestUser,
  ensureMarketDay,
  expectErrorCode,
  expectOk,
  loginAs,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('GET /api/leaderboard', () => {
  test('returns rows ordered by credits earned descending and ranks them', async ({ request }) => {
    const top = await createTestUser({ username: 'top', credits: 100 })
    const mid = await createTestUser({ username: 'mid', credits: 500 })
    const low = await createTestUser({ username: 'low', credits: 1000 })
    const market = await ensureMarketDay('2026-04-28')
    await testPrisma().bet.createMany({
      data: [
        {
          userId: low.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 540,
          bucketEndMinute: 570,
          wager: 25,
          multiplier: 2,
          status: 'WON',
          payout: 50,
          settledAt: new Date(),
        },
        {
          userId: mid.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 570,
          bucketEndMinute: 600,
          wager: 75,
          multiplier: 2,
          status: 'WON',
          payout: 150,
          settledAt: new Date(),
        },
        {
          userId: top.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 150,
          multiplier: 2,
          status: 'WON',
          payout: 300,
          settledAt: new Date(),
        },
      ],
    })
    const { token } = await loginAs(request, 'top', TEST_PASSWORD)

    const res = await request.get('/api/leaderboard', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.rows.map((r: { username: string }) => r.username)).toEqual(['top', 'mid', 'low'])
    expect(body.rows.map((r: { rank: number }) => r.rank)).toEqual([1, 2, 3])
    expect(body.rows.map((r: { creditsEarned: number }) => r.creditsEarned)).toEqual([300, 150, 50])
  })

  test('aggregates per-user bet stats (won/lost/accuracy/biggestWin)', async ({ request }) => {
    const user = await createTestUser({ username: 'aggregator', credits: 1000 })
    const market = await ensureMarketDay('2026-04-28')
    // Two won, one lost.
    await testPrisma().bet.createMany({
      data: [
        {
          userId: user.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 10,
          multiplier: 2,
          status: 'WON',
          payout: 20,
          settledAt: new Date(),
        },
        {
          userId: user.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 540,
          bucketEndMinute: 570,
          wager: 50,
          multiplier: 2,
          status: 'WON',
          payout: 100,
          settledAt: new Date(),
        },
        {
          userId: user.id,
          marketDayId: market.id,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 10,
          multiplier: 2,
          status: 'LOST',
          payout: 0,
          settledAt: new Date(),
        },
      ],
    })

    const { token } = await loginAs(request, 'aggregator', TEST_PASSWORD)
    const res = await request.get('/api/leaderboard', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const row = body.rows[0]
    expect(row.bets).toBe(3)
    expect(row.won).toBe(2)
    expect(row.lost).toBe(1)
    expect(row.creditsEarned).toBe(120)
    // accuracy = 2 / (2+1) ≈ 67%
    expect(row.accuracy).toBe(67)
    expect(row.biggestWin).toBe(100)
  })

  test('includes older bets because leaderboard is lifetime-only', async ({ request }) => {
    const user = await createTestUser({ username: 'old_better', credits: 1000 })
    const market = await ensureMarketDay('2026-04-28')
    // A bet from a year ago still counts. The leaderboard no longer has
    // today/week/all-time toggles; earned credits are lifetime-only.
    const oldDate = new Date()
    oldDate.setUTCDate(oldDate.getUTCDate() - 365)
    await testPrisma().bet.create({
      data: {
        userId: user.id,
        marketDayId: market.id,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 10,
        multiplier: 2,
        status: 'WON',
        payout: 20,
        settledAt: oldDate,
        createdAt: oldDate,
      },
    })

    const { token } = await loginAs(request, 'old_better', TEST_PASSWORD)
    const res = await request.get('/api/leaderboard', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()

    expect(body.rows[0].bets).toBe(1)
    expect(body.rows[0].creditsEarned).toBe(20)
  })

  test('requires authentication', async ({ request }) => {
    // Even with seeded data, an unauthenticated caller never sees the board.
    await createTestUser({ username: 'private', credits: 999 })
    const res = await request.get('/api/leaderboard')
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_UNAUTHENTICATED')
  })
})
