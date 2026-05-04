import { expect, test } from '@playwright/test'
import {
  TEST_PASSWORD,
  createTestInvite,
  createTestUser,
  expectErrorCode,
  expectOk,
} from './helpers/fixtures.js'
import { resetDb, testPrisma } from './helpers/db.js'

test.beforeEach(async () => {
  await resetDb()
})

test.describe('POST /api/auth/signup', () => {
  test('signs up via a valid invite token, returns user + bearer + linkage', async ({
    request,
  }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id)

    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'fresh_user',
        name: 'Fresh User',
        password: 'secretpw',
      },
    })

    await expectOk(res)
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.user.username).toBe('fresh_user')
    expect(body.user.role).toBe('USER')
    expect(body.user.credits).toBe(500)
    expect(body.token).toMatch(/^wxi_/)
    expect(body.user).not.toHaveProperty('passwordHash')

    // The new user is linked to the invite they used so admins can audit
    // who came in via which token.
    const created = await testPrisma().user.findUniqueOrThrow({
      where: { id: body.user.id },
    })
    expect(created.usedInviteId).toBe(invite.id)
  })

  test('a single invite can be redeemed by multiple users until revoked', async ({
    request,
  }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id)

    for (const username of ['claimer_one', 'claimer_two', 'claimer_three']) {
      const res = await request.post('/api/auth/signup', {
        data: {
          inviteToken: invite.token,
          username,
          name: username,
          password: 'secretpw',
        },
      })
      await expectOk(res)
    }

    const usages = await testPrisma().user.findMany({
      where: { usedInviteId: invite.id },
      select: { username: true },
      orderBy: { username: 'asc' },
    })
    expect(usages.map((u) => u.username)).toEqual([
      'claimer_one',
      'claimer_three',
      'claimer_two',
    ])
  })

  test('an invite with grantsRole=ADMIN promotes the new user to ADMIN', async ({
    request,
  }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id, { grantsRole: 'ADMIN' })

    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'rookie_admin',
        name: 'Rookie Admin',
        password: 'secretpw',
      },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.user.role).toBe('ADMIN')

    const dbUser = await testPrisma().user.findUniqueOrThrow({
      where: { username: 'rookie_admin' },
    })
    expect(dbUser.role).toBe('ADMIN')
  })

  test('rejects an unknown invite token', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: 'inv_does_not_exist_1234567890',
        username: 'bob',
        name: 'Bob',
        password: 'secretpw',
      },
    })
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_INVITE_INVALID')
  })

  test('rejects a revoked invite', async ({ request }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id, {
      revokedAt: new Date(),
    })

    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'too_late',
        name: 'Too Late',
        password: 'secretpw',
      },
    })
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_INVITE_REVOKED')
  })

  test('rejects an expired invite', async ({ request }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id, {
      expiresAt: new Date(Date.now() - 1000),
    })
    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'late_for_party',
        name: 'Late',
        password: 'secretpw',
      },
    })
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_INVITE_EXPIRED')
  })

  test('rejects duplicate usernames', async ({ request }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    await createTestUser({ username: 'taken_name' })
    const invite = await createTestInvite(admin.id)
    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'taken_name',
        name: 'Imposter',
        password: 'secretpw',
      },
    })
    expect(res.status()).toBe(409)
    await expectErrorCode(res, 'E_USERNAME_TAKEN')
  })

  test('rejects passwords shorter than 6 characters', async ({ request }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id)
    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'shortpw_user',
        name: 'Tiny',
        password: 'abc',
      },
    })
    expect(res.status()).toBe(422)
  })

  test('rejects malformed usernames (spaces, symbols)', async ({ request }) => {
    const admin = await createTestUser({ role: 'ADMIN' })
    const invite = await createTestInvite(admin.id)
    const res = await request.post('/api/auth/signup', {
      data: {
        inviteToken: invite.token,
        username: 'has spaces',
        name: 'Spaces',
        password: 'secretpw',
      },
    })
    expect(res.status()).toBe(422)
  })
})

test.describe('POST /api/auth/login', () => {
  test('returns a token for valid credentials', async ({ request }) => {
    await createTestUser({ username: 'authuser' })
    const res = await request.post('/api/auth/login', {
      data: { username: 'authuser', password: TEST_PASSWORD },
    })
    await expectOk(res)
    const body = await res.json()
    expect(body.user.username).toBe('authuser')
    expect(body.token).toMatch(/^wxi_/)
  })

  test('rejects wrong password', async ({ request }) => {
    await createTestUser({ username: 'authuser' })
    const res = await request.post('/api/auth/login', {
      data: { username: 'authuser', password: 'wrong' },
    })
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_BAD_CREDENTIALS')
  })

  test('rejects unknown username with the same generic error', async ({
    request,
  }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: 'no_such_user', password: 'whatever' },
    })
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_BAD_CREDENTIALS')
  })
})

test.describe('GET /api/auth/me', () => {
  test('returns the current user when token is valid', async ({ request }) => {
    await createTestUser({ username: 'meuser' })
    const login = await request.post('/api/auth/login', {
      data: { username: 'meuser', password: TEST_PASSWORD },
    })
    const { token } = await login.json()

    const me = await request.get('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(me)
    const body = await me.json()
    expect(body.user.username).toBe('meuser')
  })

  test('rejects requests without a token', async ({ request }) => {
    const res = await request.get('/api/auth/me')
    expect(res.status()).toBe(401)
    await expectErrorCode(res, 'E_UNAUTHENTICATED')
  })

  test('rejects garbage tokens', async ({ request }) => {
    const res = await request.get('/api/auth/me', {
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('POST /api/auth/logout', () => {
  test('invalidates the bearer token', async ({ request }) => {
    await createTestUser({ username: 'goodbye' })
    const login = await request.post('/api/auth/login', {
      data: { username: 'goodbye', password: TEST_PASSWORD },
    })
    const { token } = await login.json()

    const out = await request.post('/api/auth/logout', {
      headers: { authorization: `Bearer ${token}` },
    })
    await expectOk(out)

    const me = await request.get('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(me.status()).toBe(401)
  })
})
