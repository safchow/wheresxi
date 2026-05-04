import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createTestUser,
  ensureMarketDay,
  loginAs,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('GET /api/stats/taylor', () => {
  test('counts only real users, not the system bootstrap row', async ({
    request,
  }) => {
    await createTestUser({ username: 'system' })
    await createTestUser({ username: 'real_a' })
    await createTestUser({ username: 'real_b' })

    const { token } = await loginAs(request, 'real_a', TEST_PASSWORD)
    const res = await request.get('/api/stats/taylor', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.traderCount).toBe(2)
  })

  test('avgArrivalMinute is the mean of resolved arrivals; null when none', async ({
    request,
  }) => {
    await createTestUser({ username: 'stats_user' })
    const { token } = await loginAs(request, 'stats_user', TEST_PASSWORD)

    // No arrivals yet → null.
    const empty = await request.get('/api/stats/taylor', {
      headers: { authorization: `Bearer ${token}` },
    })
    const emptyBody = await empty.json()
    expect(emptyBody.avgArrivalMinute).toBeNull()
    expect(emptyBody.arrivalSampleSize).toBe(0)

    // Three resolved markets with minutes 580, 600, 620 → avg 600.
    for (const [date, minute] of [
      ['2026-04-28', 580],
      ['2026-04-29', 600],
      ['2026-04-30', 620],
    ] as const) {
      const m = await ensureMarketDay(date)
      await testPrisma().marketDay.update({
        where: { id: m.id },
        data: {
          status: 'RESOLVED',
          arrivedAtMinute: minute,
          resolvedAt: new Date(),
        },
      })
    }
    // A REFUNDED day should NOT contribute to the mean.
    const skipped = await ensureMarketDay('2026-05-04')
    await testPrisma().marketDay.update({
      where: { id: skipped.id },
      data: { status: 'REFUNDED', resolvedAt: new Date() },
    })

    const populated = await request.get('/api/stats/taylor', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await populated.json()
    expect(body.avgArrivalMinute).toBe(600)
    expect(body.arrivalSampleSize).toBe(3)
  })

  test('recentArrivals returns Mon\u2013Fri of this week with right kinds', async ({
    request,
  }) => {
    await createTestUser({ username: 'recent_user' })
    const { token } = await loginAs(request, 'recent_user', TEST_PASSWORD)
    const res = await request.get('/api/stats/taylor', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.recentArrivals).toHaveLength(5)
    expect(body.recentArrivals.map((d: { day: string }) => d.day)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
    ])
    // Mon and Fri are always WFH; Tue/Wed/Thu either pending/arrived/refunded.
    expect(body.recentArrivals[0].kind).toBe('wfh')
    expect(body.recentArrivals[4].kind).toBe('wfh')
  })

  test('requires authentication', async ({ request }) => {
    const res = await request.get('/api/stats/taylor')
    expect(res.status()).toBe(401)
  })
})
