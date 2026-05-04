import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import {
  type APIRequestContext,
  type APIResponse,
  expect,
} from '@playwright/test'
import type { InviteToken, MarketDay, Role, User } from '@prisma/client'
import { testPrisma } from './db.js'

const DEFAULT_PASSWORD = 'testpass123'

export type SeededUser = User & { password: string }

/**
 * Insert a user directly via Prisma so tests don't have to bootstrap an
 * invite / signup flow when they only care about a logged-in caller.
 */
export async function createTestUser(
  input: Partial<{
    username: string
    name: string
    password: string
    role: Role
    credits: number
    bankruptcies: number
  }> = {},
): Promise<SeededUser> {
  const prisma = testPrisma()
  const password = input.password ?? DEFAULT_PASSWORD
  const username =
    input.username ?? `user_${randomBytes(4).toString('hex')}`
  const passwordHash = await argon2.hash(password)
  const user = await prisma.user.create({
    data: {
      username,
      name: input.name ?? `Test ${username}`,
      passwordHash,
      role: input.role ?? 'USER',
      credits: input.credits ?? 500,
      bankruptcies: input.bankruptcies ?? 0,
    },
  })
  return { ...user, password }
}

/**
 * Create a fresh invite token for a given creator. Defaults to a
 * USER-grant, never-expires, never-revoked invite — i.e. the simplest
 * thing for tests that only care about a working signup flow.
 */
export async function createTestInvite(
  createdById: string,
  options: {
    expiresAt?: Date | null
    note?: string | null
    grantsRole?: Role
    revokedAt?: Date | null
  } = {},
): Promise<InviteToken> {
  const prisma = testPrisma()
  return prisma.inviteToken.create({
    data: {
      token: `inv_${randomBytes(12).toString('hex')}`,
      createdById,
      expiresAt: options.expiresAt ?? null,
      note: options.note ?? null,
      grantsRole: options.grantsRole ?? 'USER',
      revokedAt: options.revokedAt ?? null,
    },
  })
}

/** Hit POST /api/auth/login and return the issued bearer token. */
export async function loginAs(
  request: APIRequestContext,
  username: string,
  password: string = DEFAULT_PASSWORD,
): Promise<{ token: string; user: { id: string; username: string; role: Role } }> {
  const res = await request.post('/api/auth/login', {
    data: { username, password },
  })
  await expectOk(res)
  const body = await res.json()
  return { token: body.token, user: body.user }
}

/**
 * Convenience: create a fresh authenticated request context with the bearer
 * token preset on every request. Returned context must be `dispose()`d.
 */
export async function authedRequest(
  token: string,
): Promise<APIRequestContext> {
  const { request: requestFactory } = await import('@playwright/test')
  return requestFactory.newContext({
    baseURL: 'http://localhost:3334',
    extraHTTPHeaders: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  })
}

/** Upsert a market day (UTC midnight) for the supplied calendar date. */
export async function ensureMarketDay(date: string): Promise<MarketDay> {
  const prisma = testPrisma()
  const d = new Date(date)
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  return prisma.marketDay.upsert({
    where: { date: utc },
    update: {},
    create: { date: utc, status: 'OPEN' },
  })
}

/**
 * Returns an unlocked market by creating a fresh OPEN market dated 30 days
 * in the future (well past today's lock cutoff). Use this for tests that
 * exercise the bet placement / cancellation API path.
 */
export async function createOpenMarket(): Promise<MarketDay> {
  const prisma = testPrisma()
  const future = new Date()
  future.setUTCDate(future.getUTCDate() + 30)
  const utc = new Date(
    Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate()),
  )
  return prisma.marketDay.upsert({
    where: { date: utc },
    update: {},
    create: { date: utc, status: 'OPEN' },
  })
}

/** A market that's already past its lock time (yesterday). */
export async function createLockedMarket(): Promise<MarketDay> {
  const prisma = testPrisma()
  const past = new Date()
  past.setUTCDate(past.getUTCDate() - 1)
  const utc = new Date(
    Date.UTC(past.getUTCFullYear(), past.getUTCMonth(), past.getUTCDate()),
  )
  return prisma.marketDay.upsert({
    where: { date: utc },
    update: {},
    create: { date: utc, status: 'OPEN' },
  })
}

/** Direct DB place-bet (skips API), useful for setting up settled fixtures. */
export async function seedPendingBet(input: {
  userId: string
  marketDayId: string
  bucketStartMinute: number
  bucketEndMinute: number
  wager: number
  multiplier?: number
}) {
  const prisma = testPrisma()
  return prisma.bet.create({
    data: {
      userId: input.userId,
      marketDayId: input.marketDayId,
      granularity: 'HALF_HOUR',
      bucketStartMinute: input.bucketStartMinute,
      bucketEndMinute: input.bucketEndMinute,
      wager: input.wager,
      multiplier: input.multiplier ?? 2,
      status: 'PENDING',
    },
  })
}

/** Read the JSON error envelope from a non-2xx response. */
export async function expectErrorCode(res: APIResponse, code: string) {
  const body = await res.json()
  expect(body.error?.code).toBe(code)
  return body
}

/** Assert a 2xx response with a friendlier failure message. */
export async function expectOk(res: APIResponse) {
  if (!res.ok()) {
    const text = await res.text()
    throw new Error(
      `Expected OK but got ${res.status()} from ${res.url()}: ${text}`,
    )
  }
}

export const TEST_PASSWORD = DEFAULT_PASSWORD
