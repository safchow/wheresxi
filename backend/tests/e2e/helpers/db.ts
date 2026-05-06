import { PrismaClient } from '@prisma/client'

/**
 * Hardcoded so we don't accidentally inherit DATABASE_URL from the dev
 * `.env` (Prisma's CLI loads it on import). The webServer process gets the
 * matching URL via Playwright's webServer.command env.
 */
const TEST_DB_URL =
  'postgresql://wheresxi:wheresxi_dev@localhost:5433/wheresxi_test?schema=public'

let _prisma: PrismaClient | null = null

export function testPrisma(): PrismaClient {
  if (_prisma) return _prisma
  _prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
    log: ['error'],
  })
  return _prisma
}

/**
 * Truncate every table to give each test a clean slate. CASCADE is required
 * because of the foreign keys (`Bet.userId`, `AccessToken.userId`, etc.).
 */
export async function resetDb(): Promise<void> {
  const prisma = testPrisma()
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
      "BankruptcyEvent",
      "Bet",
      "AccessToken",
      "InviteToken",
      "MarketDay",
      "User"
    RESTART IDENTITY CASCADE;`,
  )
}

export async function disconnectDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
  }
}
