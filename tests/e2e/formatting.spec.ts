import { expect, test, type Page } from '@playwright/test'

const TEST_USER = {
  id: 'user_format_test',
  username: 'format-tester',
  name: 'Format Tester',
  email: null,
  role: 'USER',
  credits: 1250,
  bankruptcies: 0,
  createdAt: '2026-05-06T00:00:00.000Z',
}

const MARKET_DAY = {
  id: 'market_2026_05_06',
  date: '2026-05-06T00:00:00.000Z',
  status: 'OPEN',
  arrivedAtMinute: null,
  bustReason: null,
  resolvedAt: null,
  resolvedById: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  locked: false,
  lockedAt: '2026-05-06T04:00:00.000Z',
}

const ACTIVE_BET = {
  id: 'bet_active',
  userId: TEST_USER.id,
  marketDayId: MARKET_DAY.id,
  granularity: 'HALF_HOUR',
  bucketStartMinute: 540,
  bucketEndMinute: 570,
  exactMinute: null,
  wager: 25,
  multiplier: 2,
  status: 'PENDING',
  payout: 0,
  settledAt: null,
  createdAt: '2026-05-05T12:00:00.000Z',
  updatedAt: '2026-05-05T12:00:00.000Z',
  marketDay: MARKET_DAY,
}

const EXACT_WON_BET = {
  id: 'bet_exact_won',
  userId: TEST_USER.id,
  marketDayId: MARKET_DAY.id,
  granularity: 'EXACT',
  bucketStartMinute: null,
  bucketEndMinute: null,
  exactMinute: 615,
  wager: 10,
  multiplier: 60,
  status: 'WON',
  payout: 600,
  settledAt: '2026-05-06T15:00:00.000Z',
  createdAt: '2026-05-05T13:00:00.000Z',
  updatedAt: '2026-05-06T15:00:00.000Z',
  marketDay: { ...MARKET_DAY, status: 'RESOLVED', locked: true },
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => {
    localStorage.setItem('wheresxi-token', 'test-token')
  })
})

test('keeps market and dossier formatting stable', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('1.3K guesses')).toBeVisible()
  await expect(page.getByRole('tab', { name: /Wed May 6/i })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /9:00 – 9:30 42 guesses/i }),
  ).toBeVisible()
  await expect(page.getByRole('complementary').getByText('9:00 – 9:30')).toBeVisible()
  await expect(page.getByRole('complementary').getByText('Your guess for Wed May 6')).toBeVisible()
  await expect(page.getByRole('listitem').getByText('Wed May 6')).toBeVisible()
  await expect(page.getByRole('listitem').getByText('9:00 – 9:30')).toBeVisible()
  await expect(page.getByText('25 cr · 2× payout · win 50 cr')).toBeVisible()

  await expect(page.getByText('10:15 AM')).toBeVisible()
  await expect(page.getByText('12.3K')).toBeVisible()
  await expect(page.getByText('10:15', { exact: true })).toBeVisible()
})

test('keeps My Bets bet and date formatting stable', async ({ page }) => {
  await page.goto('/bets')

  await expect(page.getByText('9:00 – 9:30')).toBeVisible()
  await expect(page.getByText('10:15 AM exact')).toBeVisible()
  await expect(page.getByText('Wed May 6')).toHaveCount(2)
  await expect(page.getByText('won +590 cr')).toBeVisible()
})

async function mockApi(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: TEST_USER }),
    })
  })

  await page.route('**/api/market/week?granularity=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        markets: [
          {
            market: MARKET_DAY,
            granularity: 'HALF_HOUR',
            totalGuesses: 1250,
            buckets: [
              {
                id: 'm-540-30',
                label: '9:00 – 9:30',
                startMinutes: 540,
                endMinutes: 570,
                guesses: 42,
              },
            ],
          },
        ],
      }),
    })
  })

  await page.route('**/api/bets/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bets: [ACTIVE_BET, EXACT_WON_BET] }),
    })
  })

  await page.route('**/api/stats/taylor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        traderCount: 12_345,
        avgArrivalMinute: 615,
        arrivalSampleSize: 7,
        recentArrivals: [
          { day: 'Mon', date: '2026-05-04', kind: 'wfh' },
          { day: 'Tue', date: '2026-05-05', kind: 'pending' },
          { day: 'Wed', date: '2026-05-06', kind: 'arrived', minute: 615 },
          { day: 'Thu', date: '2026-05-07', kind: 'busted', bustReason: 'WFH_SICK' },
          { day: 'Fri', date: '2026-05-08', kind: 'refunded' },
        ],
      }),
    })
  })
}
