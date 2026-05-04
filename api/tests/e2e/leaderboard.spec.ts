import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createTestUser,
  ensureMarketDay,
  expectOk,
  loginAs,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('GET /api/leaderboard', () => {
  test('returns rows ordered by credits descending and ranks them', async ({
    request,
  }) => {
    await createTestUser({ username: 'top', credits: 1000 })
    await createTestUser({ username: 'mid', credits: 500 })
    await createTestUser({ username: 'low', credits: 100 })
    const { token } = await loginAs(request, 'top', TEST_PASSWORD)

    const res = await request.get('/api/leaderboard?range=all', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.range).toBe('all')
    expect(body.rows.map((r: { username: string }) => r.username)).toEqual([
      'top',
      'mid',
      'low',
    ])
    expect(body.rows.map((r: { rank: number }) => r.rank)).toEqual([1, 2, 3])
  })

  test('aggregates per-user bet stats (won/lost/accuracy/biggestWin)', async ({
    request,
  }) => {
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
    const res = await request.get('/api/leaderboard?range=all', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const row = body.rows[0]
    expect(row.bets).toBe(3)
    expect(row.won).toBe(2)
    expect(row.lost).toBe(1)
    // accuracy = 2 / (2+1) ≈ 67%
    expect(row.accuracy).toBe(67)
    expect(row.biggestWin).toBe(100)
  })

  test('range filter excludes older bets from stats', async ({ request }) => {
    const user = await createTestUser({ username: 'old_better', credits: 1000 })
    const market = await ensureMarketDay('2026-04-28')
    // A bet from a year ago — should be filtered out by `today` and `week`.
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
    const all = await (
      await request.get('/api/leaderboard?range=all', {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json()
    const week = await (
      await request.get('/api/leaderboard?range=week', {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json()

    expect(all.rows[0].bets).toBe(1)
    expect(week.rows[0].bets).toBe(0)
  })

  test('falls back to "week" for unknown range values', async ({ request }) => {
    await createTestUser({ username: 'fallback' })
    const { token } = await loginAs(request, 'fallback', TEST_PASSWORD)
    const res = await request.get('/api/leaderboard?range=garbage', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBe(true)
    expect((await res.json()).range).toBe('week')
  })
})
