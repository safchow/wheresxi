import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  createTestUser,
  loginAs,
  TEST_PASSWORD,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

async function authedToken(request: import('@playwright/test').APIRequestContext) {
  await createTestUser({ username: 'market_user' })
  const { token } = await loginAs(request, 'market_user', TEST_PASSWORD)
  return token
}

test.describe('GET /api/market/week', () => {
  test('returns three markets (Tue/Wed/Thu) and creates them if missing', async ({
    request,
  }) => {
    const token = await authedToken(request)

    expect(await testPrisma().marketDay.count()).toBe(0)

    const res = await request.get('/api/market/week?granularity=HALF_HOUR', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.markets).toHaveLength(3)

    const dayOfWeek = (iso: string) => new Date(iso).getUTCDay()
    const days = body.markets.map((m: { market: { date: string } }) =>
      dayOfWeek(m.market.date),
    )
    expect(days).toEqual([2, 3, 4]) // Tue, Wed, Thu

    expect(await testPrisma().marketDay.count()).toBe(3)
  })

  test('concurrent first-load requests do not race to a 500', async ({
    request,
  }) => {
    // Regression: the previous per-row upsert loop raced under parallel load
    // and threw P2002 on MarketDay.date. With createMany({ skipDuplicates:
    // true }) the inserts are atomic, so all five callers should succeed and
    // exactly three rows should land in the table.
    const token = await authedToken(request)
    expect(await testPrisma().marketDay.count()).toBe(0)

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.get('/api/market/week?granularity=HALF_HOUR', {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    )
    for (const res of responses) {
      expect(res.status(), await res.text()).toBe(200)
    }
    expect(await testPrisma().marketDay.count()).toBe(3)
  })

  test('half-hour grid has exactly 3 buckets covering 9:00–10:30', async ({
    request,
  }) => {
    const token = await authedToken(request)
    const res = await request.get('/api/market/week?granularity=HALF_HOUR', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const buckets = body.markets[0].buckets as Array<{
      startMinutes: number
      endMinutes: number
    }>
    expect(buckets).toHaveLength(3)
    expect(buckets[0]).toMatchObject({ startMinutes: 540, endMinutes: 570 })
    expect(buckets[2]).toMatchObject({ startMinutes: 600, endMinutes: 630 })
  })

  test('15-minute grid has 6 buckets, 5-minute has 18', async ({ request }) => {
    const token = await authedToken(request)
    const q = await request.get(
      '/api/market/week?granularity=QUARTER_HOUR',
      { headers: { authorization: `Bearer ${token}` } },
    )
    const f = await request.get('/api/market/week?granularity=FIVE_MIN', {
      headers: { authorization: `Bearer ${token}` },
    })
    const qb = await q.json()
    const fb = await f.json()
    expect(qb.markets[0].buckets).toHaveLength(6)
    expect(fb.markets[0].buckets).toHaveLength(18)
  })

  test('exact granularity returns no enumerated buckets', async ({
    request,
  }) => {
    const token = await authedToken(request)
    const res = await request.get('/api/market/week?granularity=EXACT', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.markets[0].buckets).toEqual([])
  })

  test('rejects unknown granularity values', async ({ request }) => {
    const token = await authedToken(request)
    const res = await request.get('/api/market/week?granularity=YEARLY', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(422)
  })

  test('requires authentication', async ({ request }) => {
    const res = await request.get('/api/market/week?granularity=HALF_HOUR')
    expect(res.status()).toBe(401)
  })
})

test.describe('GET /api/market/:id/exact-minute', () => {
  test('returns the live count of guesses at a specific minute', async ({
    request,
  }) => {
    const token = await authedToken(request)
    const week = await request.get('/api/market/week?granularity=HALF_HOUR', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { markets } = await week.json()
    const id = markets[0].market.id

    const res = await request.get(
      `/api/market/${id}/exact-minute?minute=615`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(res.ok()).toBe(true)
    expect(await res.json()).toEqual({ minute: 615, guesses: 0 })
  })

  test('rejects out-of-range minutes', async ({ request }) => {
    const token = await authedToken(request)
    const week = await request.get('/api/market/week?granularity=HALF_HOUR', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { markets } = await week.json()
    const id = markets[0].market.id

    const res = await request.get(
      `/api/market/${id}/exact-minute?minute=99999`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(res.status()).toBe(422)
  })

  test('404s on unknown market id', async ({ request }) => {
    const token = await authedToken(request)
    const res = await request.get(
      '/api/market/does_not_exist/exact-minute?minute=615',
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(res.status()).toBe(404)
  })
})
