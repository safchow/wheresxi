import { defineConfig, devices } from '@playwright/test'

const PORT = 5174
const HOST = '127.0.0.1'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
  },

  webServer: {
    command: [
      'npm run dev --',
      `--host ${HOST}`,
      `--port ${PORT}`,
      '--strictPort',
    ].join(' '),
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
