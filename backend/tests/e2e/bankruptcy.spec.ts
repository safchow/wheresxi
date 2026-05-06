import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createOpenMarket,
  createTestUser,
  expectErrorCode,
  expectOk,
  loginAs,
  seedPendingBet,
} from './helpers/fixtures.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('POST /api/bankruptcy', () => {
  test('refuses to file when you have any credits at all', async ({
    request,
  }) => {
    // Try a few balances above zero — none of them should be allowed to file.
    for (const credits of [500, 250, 100, 1]) {
      const username = `still_solvent_${credits}`
      await createTestUser({ username, credits })
      const { token } = await loginAs(request, username, TEST_PASSWORD)
      const res = await request.post('/api/bankruptcy', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status(), `credits=${credits} should reject`).toBe(409)
      await expectErrorCode(res, 'E_TOO_RICH_TO_BUST')
    }
  })

  test('files successfully only when credits hit exactly 0', async ({
    request,
  }) => {
    const user = await createTestUser({ username: 'flat_broke', credits: 0 })
    const { token } = await loginAs(request, 'flat_broke', TEST_PASSWORD)
    const res = await request.post('/api/bankruptcy', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(res)
    expect((await res.json()).credits).toBe(500)

    const updated = await testPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
    })
    expect(updated.credits).toBe(500)
    expect(updated.bankruptcies).toBe(1)

    const events = await testPrisma().bankruptcyEvent.findMany({
      where: { userId: user.id },
    })
    expect(events).toHaveLength(1)
    expect(events[0].atCredits).toBe(0)
    expect(events[0].resetTo).toBe(500)
  })

  test('post-reset balance of 500 cr blocks immediately re-filing', async ({
    request,
  }) => {
    await createTestUser({ username: 'twice_broke', credits: 0 })
    const { token } = await loginAs(request, 'twice_broke', TEST_PASSWORD)
    // First filing succeeds.
    await expectOk(
      await request.post('/api/bankruptcy', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    // We're back at 500 — no filing.
    const second = await request.post('/api/bankruptcy', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(second.status()).toBe(409)
    await expectErrorCode(second, 'E_TOO_RICH_TO_BUST')
  })

  test('two filings increment the counter to 2 (after a re-bust)', async ({
    request,
  }) => {
    const user = await createTestUser({ username: 'serial', credits: 0 })
    const { token } = await loginAs(request, 'serial', TEST_PASSWORD)
    await expectOk(
      await request.post('/api/bankruptcy', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    // Wipe their credits again to simulate losing all 500 to bets.
    await testPrisma().user.update({
      where: { id: user.id },
      data: { credits: 0 },
    })
    await expectOk(
      await request.post('/api/bankruptcy', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    const final = await testPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
    })
    expect(final.bankruptcies).toBe(2)
    expect(final.credits).toBe(500)
  })

  test('rejects filing while a pending bet is still in flight', async ({
    request,
  }) => {
    const user = await createTestUser({ username: 'pending_filer', credits: 0 })
    const market = await createOpenMarket()
    await seedPendingBet({
      userId: user.id,
      marketDayId: market.id,
      bucketStartMinute: 540,
      bucketEndMinute: 570,
      wager: 100,
    })

    const { token } = await loginAs(request, 'pending_filer', TEST_PASSWORD)
    const res = await request.post('/api/bankruptcy', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_HAS_PENDING_BETS')

    // No bankruptcy event written, no credits refilled, counter untouched.
    const after = await testPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
    })
    expect(after.credits).toBe(0)
    expect(after.bankruptcies).toBe(0)
    expect(
      await testPrisma().bankruptcyEvent.count({ where: { userId: user.id } }),
    ).toBe(0)
  })

  test('lets you file once the pending bet is cancelled', async ({
    request,
  }) => {
    const user = await createTestUser({ username: 'cancel_then_file', credits: 0 })
    const market = await createOpenMarket()
    const bet = await seedPendingBet({
      userId: user.id,
      marketDayId: market.id,
      bucketStartMinute: 540,
      bucketEndMinute: 570,
      wager: 50,
    })

    // Settled bets (CANCELLED here) shouldn't block — only PENDING does.
    await testPrisma().bet.update({
      where: { id: bet.id },
      data: { status: 'CANCELLED', settledAt: new Date() },
    })

    const { token } = await loginAs(request, 'cancel_then_file', TEST_PASSWORD)
    const res = await request.post('/api/bankruptcy', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(res)
    expect((await res.json()).credits).toBeGreaterThan(0)
  })

  test('requires authentication', async ({ request }) => {
    const res = await request.post('/api/bankruptcy')
    expect(res.status()).toBe(401)
  })
})
