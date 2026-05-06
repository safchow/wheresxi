import { expect, test } from '@playwright/test'
import { resetDb, testPrisma } from './helpers/db.js'
import {
  TEST_PASSWORD,
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

test.describe('admin route gate', () => {
  /**
   * Every admin endpoint, hit twice:
   *  1. Unauthenticated → 401 (caught by `auth` middleware first)
   *  2. Authenticated as a USER → 403 with code `E_FORBIDDEN`
   *     (caught by the `role` middleware that the admin group is wrapped in)
   *
   * The url/method pairs here are the canonical list of admin-only routes.
   * Add new admin endpoints to this table to keep the gate enforced.
   */
  const ADMIN_ROUTES: Array<{
    name: string
    method: 'GET' | 'POST' | 'DELETE'
    path: string
    body?: unknown
  }> = [
    { name: 'GET    /admin/markets', method: 'GET', path: '/api/admin/markets' },
    {
      name: 'GET    /admin/markets/:id/bets',
      method: 'GET',
      path: '/api/admin/markets/some_id/bets',
    },
    {
      name: 'POST   /admin/markets/resolve',
      method: 'POST',
      path: '/api/admin/markets/resolve',
      body: { date: '2026-04-28', arrivedAtMinute: 600 },
    },
    {
      name: 'POST   /admin/markets/refund',
      method: 'POST',
      path: '/api/admin/markets/refund',
      body: { date: '2026-04-28' },
    },
    { name: 'GET    /admin/invites', method: 'GET', path: '/api/admin/invites' },
    {
      name: 'POST   /admin/invites',
      method: 'POST',
      path: '/api/admin/invites',
      body: {},
    },
    {
      name: 'DELETE /admin/invites/:id',
      method: 'DELETE',
      path: '/api/admin/invites/some_id',
    },
    { name: 'GET    /admin/audit', method: 'GET', path: '/api/admin/audit' },
  ]

  for (const route of ADMIN_ROUTES) {
    test(`unauthenticated ${route.name} → 401`, async ({ request }) => {
      const res =
        route.method === 'GET'
          ? await request.get(route.path)
          : route.method === 'DELETE'
            ? await request.delete(route.path)
            : await request.post(route.path, { data: route.body })
      expect(res.status()).toBe(401)
      await expectErrorCode(res, 'E_UNAUTHENTICATED')
    })

    test(`non-admin ${route.name} → 403`, async ({ request }) => {
      await createTestUser({ username: `pleb_${randomSuffix()}` })
      const username = await testPrisma()
        .user.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
        .then((u) => u.username)
      const { token } = await loginAs(request, username, TEST_PASSWORD)
      const headers = { authorization: `Bearer ${token}` }
      const res =
        route.method === 'GET'
          ? await request.get(route.path, { headers })
          : route.method === 'DELETE'
            ? await request.delete(route.path, { headers })
            : await request.post(route.path, { headers, data: route.body })
      expect(res.status()).toBe(403)
      await expectErrorCode(res, 'E_FORBIDDEN')
    })
  }
})

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

test.describe('POST /api/admin/markets/resolve (arrived)', () => {
  test('marks winning bets WON and credits payouts; losers get LOST', async ({
    request,
  }) => {
    const admin = await createTestUser({ username: 'res_admin', role: 'ADMIN' })
    const winner = await createTestUser({ username: 'winner', credits: 200 })
    const loser = await createTestUser({ username: 'loser', credits: 200 })
    const market = await ensureMarketDay('2026-04-28')

    await seedPendingBet({
      userId: winner.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 40,
    })
    await seedPendingBet({
      userId: loser.id,
      marketDayId: market.id,
      bucketStartMinute: 540,
      bucketEndMinute: 570,
      wager: 30,
    })
    // Pretend wagers were already debited at placement.
    await testPrisma().user.update({
      where: { id: winner.id },
      data: { credits: 160 },
    })
    await testPrisma().user.update({
      where: { id: loser.id },
      data: { credits: 170 },
    })

    const { token } = await loginAs(request, 'res_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 615 },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.market.status).toBe('RESOLVED')
    expect(body.market.arrivedAtMinute).toBe(615)
    expect(body.settled).toEqual({ won: 1, lost: 1, payoutTotal: 80 })

    const updatedWinner = await testPrisma().user.findUniqueOrThrow({
      where: { id: winner.id },
    })
    const updatedLoser = await testPrisma().user.findUniqueOrThrow({
      where: { id: loser.id },
    })
    expect(updatedWinner.credits).toBe(160 + 80) // payout = 40 * 2
    expect(updatedLoser.credits).toBe(170)

    expect(admin).toBeTruthy() // satisfy unused-var lint
  })

  test('exact-minute bets win only on the exact match', async ({ request }) => {
    await createTestUser({ username: 'exact_admin', role: 'ADMIN' })
    const sniper = await createTestUser({ username: 'sniper', credits: 100 })
    const nearMiss = await createTestUser({ username: 'near_miss', credits: 100 })
    const market = await ensureMarketDay('2026-04-28')

    await testPrisma().bet.create({
      data: {
        userId: sniper.id,
        marketDayId: market.id,
        granularity: 'EXACT',
        exactMinute: 615,
        wager: 5,
        multiplier: 60,
        status: 'PENDING',
      },
    })
    await testPrisma().bet.create({
      data: {
        userId: nearMiss.id,
        marketDayId: market.id,
        granularity: 'EXACT',
        exactMinute: 614,
        wager: 5,
        multiplier: 60,
        status: 'PENDING',
      },
    })
    await testPrisma().user.update({
      where: { id: sniper.id },
      data: { credits: 95 },
    })
    await testPrisma().user.update({
      where: { id: nearMiss.id },
      data: { credits: 95 },
    })

    const { token } = await loginAs(request, 'exact_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 615 },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.settled).toEqual({ won: 1, lost: 1, payoutTotal: 300 })
    const sniperFinal = await testPrisma().user.findUniqueOrThrow({
      where: { id: sniper.id },
    })
    const missFinal = await testPrisma().user.findUniqueOrThrow({
      where: { id: nearMiss.id },
    })
    expect(sniperFinal.credits).toBe(95 + 300)
    expect(missFinal.credits).toBe(95)
  })

  test('bust resolution loses every bet without payouts', async ({
    request,
  }) => {
    await createTestUser({ username: 'bust_admin', role: 'ADMIN' })
    const better = await createTestUser({ username: 'unlucky', credits: 100 })
    const market = await ensureMarketDay('2026-04-29')
    await seedPendingBet({
      userId: better.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })
    await testPrisma().user.update({
      where: { id: better.id },
      data: { credits: 75 },
    })

    const { token } = await loginAs(request, 'bust_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-29', bustReason: 'AFTER_TENTHIRTY' },
    })
    await expectOk(res)
    expect((await res.json()).settled).toEqual({
      won: 0,
      lost: 1,
      payoutTotal: 0,
    })
    expect(
      (await testPrisma().user.findUniqueOrThrow({ where: { id: better.id } }))
        .credits,
    ).toBe(75)
  })

  test('rejects sending both arrivedAtMinute and bustReason', async ({
    request,
  }) => {
    await createTestUser({ username: 'bad_admin', role: 'ADMIN' })
    const { token } = await loginAs(request, 'bad_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        date: '2026-04-28',
        arrivedAtMinute: 600,
        bustReason: 'AFTER_TENTHIRTY',
      },
    })
    expect(res.status()).toBe(422)
    await expectErrorCode(res, 'E_BAD_RESOLVE')
  })

  test('rejects re-resolving an already-resolved market', async ({ request }) => {
    await createTestUser({ username: 'twice_admin', role: 'ADMIN' })
    const { token } = await loginAs(request, 'twice_admin', TEST_PASSWORD)
    const first = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 600 },
    })
    await expectOk(first)
    const second = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 605 },
    })
    expect(second.status()).toBe(409)
    await expectErrorCode(second, 'E_MARKET_RESOLVED')
  })
})

test.describe('POST /api/admin/markets/refund', () => {
  test('refunds every pending bet and marks the market REFUNDED', async ({
    request,
  }) => {
    await createTestUser({ username: 'refund_admin', role: 'ADMIN' })
    const a = await createTestUser({ username: 'a', credits: 100 })
    const b = await createTestUser({ username: 'b', credits: 100 })
    const market = await ensureMarketDay('2026-04-30')
    await seedPendingBet({
      userId: a.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })
    await seedPendingBet({
      userId: b.id,
      marketDayId: market.id,
      bucketStartMinute: 540,
      bucketEndMinute: 570,
      wager: 75,
    })
    await testPrisma().user.update({
      where: { id: a.id },
      data: { credits: 75 },
    })
    await testPrisma().user.update({
      where: { id: b.id },
      data: { credits: 25 },
    })

    const { token } = await loginAs(request, 'refund_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/refund', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-30' },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.market.status).toBe('REFUNDED')
    expect(body.refundedCount).toBe(2)
    expect(body.refundTotal).toBe(100)

    const aFinal = await testPrisma().user.findUniqueOrThrow({
      where: { id: a.id },
    })
    const bFinal = await testPrisma().user.findUniqueOrThrow({
      where: { id: b.id },
    })
    expect(aFinal.credits).toBe(100)
    expect(bFinal.credits).toBe(100)
  })

  test('won\u2019t refund a market that\u2019s already resolved', async ({
    request,
  }) => {
    await createTestUser({ username: 'rs_admin', role: 'ADMIN' })
    const market = await ensureMarketDay('2026-04-30')
    await testPrisma().marketDay.update({
      where: { id: market.id },
      data: { status: 'RESOLVED', arrivedAtMinute: 600, resolvedAt: new Date() },
    })
    const { token } = await loginAs(request, 'rs_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/refund', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-30' },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_MARKET_RESOLVED')
  })
})

test.describe('admin invites', () => {
  test('admin can create an invite with a role grant, and list it with usage stats', async ({
    request,
  }) => {
    await createTestUser({ username: 'inv_admin', role: 'ADMIN' })
    const { token } = await loginAs(request, 'inv_admin', TEST_PASSWORD)
    const create = await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        note: 'team onboarding',
        expiresInDays: 7,
        grantsRole: 'ADMIN',
      },
    })
    expect(create.status()).toBe(201)
    const created = (await create.json()).invite
    expect(created.token).toMatch(/^inv_/)
    expect(created.note).toBe('team onboarding')
    expect(created.grantsRole).toBe('ADMIN')
    expect(created.revokedAt).toBeNull()

    const list = await request.get('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
    })
    const invites = (await list.json()).invites
    expect(invites).toHaveLength(1)
    expect(invites[0].usageCount).toBe(0)
    expect(invites[0].usages).toEqual([])
  })

  test('list returns the redeemers each invite has accumulated', async ({
    request,
  }) => {
    const admin = await createTestUser({ username: 'usage_admin', role: 'ADMIN' })
    const { token } = await loginAs(request, 'usage_admin', TEST_PASSWORD)
    const create = await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: {},
    })
    const invite = (await create.json()).invite

    // Direct-DB seed two redeemers (skips the rate-limited signup endpoint).
    for (const username of ['claim_a', 'claim_b']) {
      await testPrisma().user.create({
        data: {
          username,
          name: username,
          passwordHash: 'disabled',
          credits: 0,
          usedInviteId: invite.id,
        },
      })
    }

    const list = await request.get('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
    })
    const [row] = (await list.json()).invites
    expect(row.usageCount).toBe(2)
    expect(row.usages.map((u: { username: string }) => u.username).sort()).toEqual([
      'claim_a',
      'claim_b',
    ])
    expect(admin.id).toBeTruthy()
  })

  test('revoking sets revokedAt; revoking the same invite twice is a 409', async ({
    request,
  }) => {
    await createTestUser({ username: 'rev_admin', role: 'ADMIN' })
    const { token } = await loginAs(request, 'rev_admin', TEST_PASSWORD)

    const create = await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: {},
    })
    const inviteId = (await create.json()).invite.id

    const del = await request.delete(`/api/admin/invites/${inviteId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.status()).toBe(204)

    const after = await testPrisma().inviteToken.findUniqueOrThrow({
      where: { id: inviteId },
    })
    expect(after.revokedAt).not.toBeNull()

    // Second attempt → 409, audit log doesn't double-count.
    const second = await request.delete(`/api/admin/invites/${inviteId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(second.status()).toBe(409)
    await expectErrorCode(second, 'E_INVITE_ALREADY_REVOKED')
  })

  test('revoking an invite that already has redeemers preserves their linkage', async ({
    request,
  }) => {
    await createTestUser({ username: 'preserve_admin', role: 'ADMIN' })
    const { token } = await loginAs(
      request,
      'preserve_admin',
      TEST_PASSWORD,
    )

    const create = await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: {},
    })
    const invite = (await create.json()).invite

    const claimer = await testPrisma().user.create({
      data: {
        username: 'preserved',
        name: 'Preserved',
        passwordHash: 'disabled',
        credits: 0,
        usedInviteId: invite.id,
      },
    })

    const del = await request.delete(`/api/admin/invites/${invite.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.status()).toBe(204)

    const stillLinked = await testPrisma().user.findUniqueOrThrow({
      where: { id: claimer.id },
    })
    expect(stillLinked.usedInviteId).toBe(invite.id)
  })
})

test.describe('GET /api/admin/markets/:id/bets', () => {
  test('returns bets for a market with username metadata', async ({
    request,
  }) => {
    const admin = await createTestUser({ username: 'list_admin', role: 'ADMIN' })
    const better = await createTestUser({ username: 'list_better', credits: 100 })
    const market = await ensureMarketDay('2026-04-28')
    await seedPendingBet({
      userId: better.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 10,
    })

    const { token } = await loginAs(request, 'list_admin', TEST_PASSWORD)
    const res = await request.get(`/api/admin/markets/${market.id}/bets`, {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.bets).toHaveLength(1)
    expect(body.bets[0].user.username).toBe('list_better')

    expect(admin.id).toBeTruthy()
  })
})

test.describe('admin audit log', () => {
  test('records a RESOLVE_MARKET entry with payload', async ({ request }) => {
    const admin = await createTestUser({
      username: 'audit_resolver',
      role: 'ADMIN',
    })
    await ensureMarketDay('2026-04-28')

    const { token } = await loginAs(request, 'audit_resolver', TEST_PASSWORD)
    await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 615 },
    })

    const audit = await request.get('/api/admin/audit', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(audit)
    const { entries } = await audit.json()
    expect(entries).toHaveLength(1)
    expect(entries[0].action).toBe('RESOLVE_MARKET')
    expect(entries[0].admin.username).toBe('audit_resolver')
    expect(entries[0].targetType).toBe('MarketDay')
    expect(entries[0].payload.arrivedAtMinute).toBe(615)
    expect(admin.id).toBeTruthy()
  })

  test('records a REFUND_MARKET entry', async ({ request }) => {
    await createTestUser({ username: 'audit_refunder', role: 'ADMIN' })
    await ensureMarketDay('2026-04-29')
    const { token } = await loginAs(request, 'audit_refunder', TEST_PASSWORD)
    await request.post('/api/admin/markets/refund', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-29' },
    })
    const audit = await request.get('/api/admin/audit', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { entries } = await audit.json()
    const refundEntry = entries.find(
      (e: { action: string }) => e.action === 'REFUND_MARKET',
    )
    expect(refundEntry).toBeDefined()
    expect(refundEntry.targetType).toBe('MarketDay')
  })

  test('records CREATE_INVITE and REVOKE_INVITE entries', async ({
    request,
  }) => {
    await createTestUser({ username: 'audit_inviter', role: 'ADMIN' })
    const { token } = await loginAs(request, 'audit_inviter', TEST_PASSWORD)
    const create = await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: { note: 'audit me' },
    })
    const inviteId = (await create.json()).invite.id
    await request.delete(`/api/admin/invites/${inviteId}`, {
      headers: { authorization: `Bearer ${token}` },
    })

    const audit = await request.get('/api/admin/audit', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { entries } = await audit.json()
    const actions = entries.map((e: { action: string }) => e.action).sort()
    expect(actions).toEqual(['CREATE_INVITE', 'REVOKE_INVITE'])
  })

  test('returns entries newest-first', async ({ request }) => {
    await createTestUser({ username: 'audit_order', role: 'ADMIN' })
    const { token } = await loginAs(request, 'audit_order', TEST_PASSWORD)
    await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: { note: 'first' },
    })
    await new Promise((r) => setTimeout(r, 5))
    await request.post('/api/admin/invites', {
      headers: { authorization: `Bearer ${token}` },
      data: { note: 'second' },
    })
    const audit = await request.get('/api/admin/audit', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { entries } = await audit.json()
    expect(entries[0].payload.note).toBe('second')
    expect(entries[1].payload.note).toBe('first')
  })
})
