import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
  createTestUser,
  expectErrorCode,
  expectOk,
  loginAs,
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

  test('requires authentication', async ({ request }) => {
    const res = await request.post('/api/bankruptcy')
    expect(res.status()).toBe(401)
  })
})
