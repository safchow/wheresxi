import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createOpenMarket,
  createLockedMarket,
  createTestUser,
  ensureMarketDay,
  expectErrorCode,
  expectOk,
  loginAs,
  seedPendingBet,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('POST /api/bets', () => {
  test('places a half-hour bet, debits credits, and returns PENDING', async ({
    request,
  }) => {
    await createTestUser({ username: 'bettor', credits: 500 })
    const { token } = await loginAs(request, 'bettor', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    const res = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 25,
      },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.bet).toMatchObject({
      status: 'PENDING',
      wager: 25,
      multiplier: 2,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
    })

    const me = await request.get('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await me.json()).user.credits).toBe(475)
  })

  test('locks in the right multiplier per granularity', async ({ request }) => {
    await createTestUser({ username: 'multi', credits: 1000 })
    const { token } = await loginAs(request, 'multi', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    const cases: Array<[string, Record<string, number>, number]> = [
      ['HALF_HOUR', { bucketStartMinute: 540, bucketEndMinute: 570 }, 2],
      [
        'QUARTER_HOUR',
        { bucketStartMinute: 540, bucketEndMinute: 555 },
        4,
      ],
      ['FIVE_MIN', { bucketStartMinute: 540, bucketEndMinute: 545 }, 12],
      ['EXACT', { exactMinute: 615 }, 60],
    ]
    for (const [granularity, coords, multiplier] of cases) {
      const res = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: { marketDayId, granularity, wager: 5, ...coords },
      })
      expect(res.status()).toBe(201)
      expect((await res.json()).bet.multiplier).toBe(multiplier)
    }
  })

  test('rejects buckets that aren\u2019t on the granularity grid', async ({
    request,
  }) => {
    await createTestUser({ username: 'gridslip' })
    const { token } = await loginAs(request, 'gridslip', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    const res = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 605, // not aligned with the 30-min grid
        bucketEndMinute: 635,
        wager: 5,
      },
    })
    expect(res.status()).toBe(422)
    await expectErrorCode(res, 'E_BAD_BUCKET')
  })

  test('rejects exact minute outside the 9:00\u201310:30 window', async ({
    request,
  }) => {
    await createTestUser({ username: 'outwindow' })
    const { token } = await loginAs(request, 'outwindow', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    const res = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId,
        granularity: 'EXACT',
        exactMinute: 631, // out-of-window
        wager: 5,
      },
    })
    expect(res.status()).toBe(422)
    await expectErrorCode(res, 'E_BAD_BUCKET')
  })

  test.describe('credit guardrails', () => {
    test('rejects wagers that exceed user credits', async ({ request }) => {
      await createTestUser({ username: 'broke', credits: 10 })
      const { token } = await loginAs(request, 'broke', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id

      const res = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 50,
        },
      })
      expect(res.status()).toBe(422)
      await expectErrorCode(res, 'E_INSUFFICIENT_CREDITS')
    })

    test('rejects wagers that are exactly one credit over', async ({
      request,
    }) => {
      await createTestUser({ username: 'one_over', credits: 50 })
      const { token } = await loginAs(request, 'one_over', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id
      const res = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 51,
        },
      })
      expect(res.status()).toBe(422)
      await expectErrorCode(res, 'E_INSUFFICIENT_CREDITS')
    })

    test('a wager equal to balance is allowed (boundary)', async ({
      request,
    }) => {
      await createTestUser({ username: 'all_in', credits: 50 })
      const { token } = await loginAs(request, 'all_in', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id
      const res = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 50,
        },
      })
      expect(res.status()).toBe(201)
      const me = await request.get('/api/auth/me', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect((await me.json()).user.credits).toBe(0)
    })

    test('a user at zero credits cannot place even a 1 cr wager', async ({
      request,
    }) => {
      await createTestUser({ username: 'zero', credits: 0 })
      const { token } = await loginAs(request, 'zero', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id
      const res = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 1,
        },
      })
      expect(res.status()).toBe(422)
      await expectErrorCode(res, 'E_INSUFFICIENT_CREDITS')
    })

    test('cumulative wagers across two bets respect the running balance', async ({
      request,
    }) => {
      await createTestUser({ username: 'split', credits: 60 })
      const { token } = await loginAs(request, 'split', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id
      // First bet of 40 succeeds → 20 left.
      const first = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 40,
        },
      })
      expect(first.status()).toBe(201)
      // Second bet of 30 must fail — only 20 cr left.
      const second = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 540,
          bucketEndMinute: 570,
          wager: 30,
        },
      })
      expect(second.status()).toBe(422)
      await expectErrorCode(second, 'E_INSUFFICIENT_CREDITS')
    })

    test('cancelling a bet refunds wager so it can be re-spent', async ({
      request,
    }) => {
      await createTestUser({ username: 'recycler', credits: 40 })
      const { token } = await loginAs(request, 'recycler', TEST_PASSWORD)
      const marketDayId = (await createOpenMarket()).id
      const place = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager: 40,
        },
      })
      const id = (await place.json()).bet.id
      // Now broke; second bet should fail.
      const blocked = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 540,
          bucketEndMinute: 570,
          wager: 5,
        },
      })
      expect(blocked.status()).toBe(422)

      // Cancel → balance restored.
      await request.delete(`/api/bets/${id}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      const retry = await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 540,
          bucketEndMinute: 570,
          wager: 5,
        },
      })
      expect(retry.status()).toBe(201)
    })
  })

  test('rejects bets on a closed (resolved) market', async ({ request }) => {
    const admin = await createTestUser({ username: 'admin_close', role: 'ADMIN' })
    await createTestUser({ username: 'late_bettor', credits: 500 })
    const market = await ensureMarketDay('2026-01-13')
    await testPrisma().marketDay.update({
      where: { id: market.id },
      data: {
        status: 'RESOLVED',
        arrivedAtMinute: 600,
        resolvedAt: new Date(),
        resolvedById: admin.id,
      },
    })

    const { token } = await loginAs(request, 'late_bettor', TEST_PASSWORD)
    const res = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId: market.id,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 5,
      },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_MARKET_CLOSED')
  })

  test('rejects bets on a market past its lock time (yesterday)', async ({
    request,
  }) => {
    await createTestUser({ username: 'past_due', credits: 500 })
    const market = await createLockedMarket()
    const { token } = await loginAs(request, 'past_due', TEST_PASSWORD)
    const res = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId: market.id,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 5,
      },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_MARKET_LOCKED')
  })

  test('requires authentication', async ({ request }) => {
    const res = await request.post('/api/bets', {
      data: {
        marketDayId: 'whatever',
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 5,
      },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('DELETE /api/bets/:id (cancel)', () => {
  test('refunds the wager and marks the bet CANCELLED', async ({ request }) => {
    await createTestUser({ username: 'canceller', credits: 100 })
    const { token } = await loginAs(request, 'canceller', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    const placeRes = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 40,
      },
    })
    const { bet } = await placeRes.json()

    const cancelRes = await request.delete(`/api/bets/${bet.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(cancelRes)
    const cancelled = (await cancelRes.json()).bet
    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.payout).toBe(40)

    const me = await request.get('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await me.json()).user.credits).toBe(100)
  })

  test('rejects cancelling a bet you don\u2019t own (403)', async ({
    request,
  }) => {
    const owner = await createTestUser({ username: 'mine_only', credits: 200 })
    await createTestUser({ username: 'meddler' })
    const market = await ensureMarketDay('2026-01-14')
    const bet = await seedPendingBet({
      userId: owner.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 20,
    })

    const { token } = await loginAs(request, 'meddler', TEST_PASSWORD)
    const res = await request.delete(`/api/bets/${bet.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(403)
    await expectErrorCode(res, 'E_FORBIDDEN')
  })

  test('404s for unknown bet id', async ({ request }) => {
    await createTestUser({ username: 'looker' })
    const { token } = await loginAs(request, 'looker', TEST_PASSWORD)
    const res = await request.delete('/api/bets/no_such_bet', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(404)
  })

  test('rejects double-cancel (already settled)', async ({ request }) => {
    await createTestUser({ username: 'twice', credits: 100 })
    const { token } = await loginAs(request, 'twice', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id
    const place = await request.post('/api/bets', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        marketDayId,
        granularity: 'HALF_HOUR',
        bucketStartMinute: 600,
        bucketEndMinute: 630,
        wager: 10,
      },
    })
    const id = (await place.json()).bet.id

    await request.delete(`/api/bets/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const second = await request.delete(`/api/bets/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(second.status()).toBe(409)
    await expectErrorCode(second, 'E_BET_SETTLED')
  })

  test('rejects cancelling once the market is locked (past cutoff)', async ({
    request,
  }) => {
    const owner = await createTestUser({ username: 'lock_cancel', credits: 100 })
    const market = await createLockedMarket()
    const bet = await seedPendingBet({
      userId: owner.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })

    const { token } = await loginAs(request, 'lock_cancel', TEST_PASSWORD)
    const res = await request.delete(`/api/bets/${bet.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_MARKET_LOCKED')
  })

  test('rejects cancelling once the market is closed', async ({ request }) => {
    const owner = await createTestUser({ username: 'too_late', credits: 100 })
    const market = await ensureMarketDay('2026-01-15')
    const bet = await seedPendingBet({
      userId: owner.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 30,
    })
    await testPrisma().marketDay.update({
      where: { id: market.id },
      data: { status: 'RESOLVED', arrivedAtMinute: 600, resolvedAt: new Date() },
    })
    // Force the bet to remain PENDING so we test the market-status guard
    // specifically (a normal resolve would have already settled the bet).
    await testPrisma().bet.update({
      where: { id: bet.id },
      data: { status: 'PENDING' },
    })

    const { token } = await loginAs(request, 'too_late', TEST_PASSWORD)
    const res = await request.delete(`/api/bets/${bet.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_MARKET_CLOSED')
  })
})

test.describe('GET /api/bets/me', () => {
  test('returns the caller\u2019s bets, newest first', async ({ request }) => {
    await createTestUser({ username: 'mine_bets', credits: 1000 })
    const { token } = await loginAs(request, 'mine_bets', TEST_PASSWORD)
    const marketDayId = (await createOpenMarket()).id

    for (const wager of [10, 20, 30]) {
      await request.post('/api/bets', {
        headers: { authorization: `Bearer ${token}` },
        data: {
          marketDayId,
          granularity: 'HALF_HOUR',
          bucketStartMinute: 600,
          bucketEndMinute: 630,
          wager,
        },
      })
    }

    const res = await request.get('/api/bets/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.bets).toHaveLength(3)
    expect(body.bets.map((b: { wager: number }) => b.wager)).toEqual([
      30, 20, 10,
    ])
  })
})
