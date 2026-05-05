import { defineConfig } from '@playwright/test'

const PORT = 3334
const HOST = 'localhost'
const TEST_DB_URL =
  'postgresql://wheresxi:wheresxi_dev@localhost:5433/wheresxi_test?schema=public'

/**
 * Playwright config for the wheresxi API integration suite.
 *
 *   npm run test:e2e
 *
 * Spins up the Adonis app on a separate port (3334) against the
 * `wheresxi_test` Postgres database. Tests truncate every table between
 * cases for hard isolation — see `tests/e2e/helpers/db.ts`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: `http://${HOST}:${PORT}`,
    extraHTTPHeaders: {
      accept: 'application/json',
    },
  },

  webServer: {
    // cross-env ensures the test DATABASE_URL is in process.env *before*
    // Adonis starts loading dot-env files, which prevents the dev `.env`
    // from leaking into tests via the env loader's parallel-Promise race.
    command: [
      'cross-env',
      'NODE_ENV=test',
      `PORT=${PORT}`,
      `HOST=${HOST}`,
      'LOG_LEVEL=warn',
      'APP_KEY=test-key-please-do-not-use-this-in-production',
      `DATABASE_URL=${TEST_DB_URL}`,
      'ACCESS_TOKEN_TTL_DAYS=30',
      'USER_STARTING_CREDITS=500',
      'TZ=UTC',
      'node ace serve',
    ].join(' '),
    url: `http://${HOST}:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'api',
      testMatch: /.*\.spec\.ts$/,
    },
  ],
})

export { TEST_DB_URL }
