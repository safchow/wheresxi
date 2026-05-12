import { createHmac } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  createOpenMarket,
  createTestUser,
  ensureMarketDay,
  expectOk,
  loginAs,
  seedPendingBet,
  TEST_PASSWORD,
} from './helpers/fixtures.js'
import { disconnectDb, resetDb, testPrisma } from './helpers/db.js'

const SIGNING_SECRET = 'test-slack-secret'
const INTERNAL_SECRET = 'test-internal-slack-secret'

function signedSlackHeaders(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const base = `v0:${timestamp}:${body}`
  const signature = `v0=${createHmac('sha256', SIGNING_SECRET).update(base).digest('hex')}`
  return {
    'content-type': 'application/x-www-form-urlencoded',
    'x-slack-request-timestamp': String(timestamp),
    'x-slack-signature': signature,
  }
}

function commandBody(fields: Record<string, string>) {
  return new URLSearchParams({
    token: 'deprecated-verification-token',
    team_id: 'T123',
    team_domain: 'wheresxi',
    channel_id: 'C123',
    channel_name: 'general',
    user_id: 'U123',
    user_name: 'saf',
    command: '/wheresxi',
    response_url: 'https://hooks.slack.test/response',
    trigger_id: 'trigger-123',
    ...fields,
  }).toString()
}

function interactionBody(payload: Record<string, unknown>) {
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
}

async function postSlackCommand(
  request: APIRequestContext,
  fields: Record<string, string>,
  timestamp?: number
) {
  const body = commandBody(fields)
  return request.post('/api/slack/commands', {
    data: body,
    headers: signedSlackHeaders(body, timestamp),
  })
}

test.beforeEach(async () => {
  await resetDb()
})

test.afterAll(async () => {
  await disconnectDb()
})

test.describe('Slack request verification', () => {
  test('rejects invalid signatures', async ({ request }) => {
    const body = commandBody({ text: 'help' })
    const res = await request.post('/api/slack/commands', {
      data: body,
      headers: {
        ...signedSlackHeaders(body),
        'x-slack-signature': 'v0=bad',
      },
    })

    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({
      error: {
        code: 'E_SLACK_SIGNATURE',
        message: 'Invalid Slack signature',
      },
    })
  })

  test('rejects stale timestamps', async ({ request }) => {
    const stale = Math.floor(Date.now() / 1000) - 60 * 10
    const res = await postSlackCommand(request, { text: 'help' }, stale)

    expect(res.status()).toBe(401)
    expect((await res.json()).error.code).toBe('E_SLACK_SIGNATURE')
  })
})

test.describe('Slack linking and read commands', () => {
  test('creates a short-lived link code and lets a logged-in user claim it', async ({
    request,
  }) => {
    const user = await createTestUser({ username: 'slack_linker' })
    const command = await postSlackCommand(request, { text: 'link' })
    await expectOk(command)
    const commandBodyJson = await command.json()

    expect(commandBodyJson.response_type).toBe('ephemeral')
    expect(commandBodyJson.text).toContain('http://localhost:5173/slack/link?code=')

    const token = await testPrisma().slackLinkToken.findFirstOrThrow()
    const { token: authToken } = await loginAs(request, user.username, TEST_PASSWORD)
    const link = await request.post('/api/slack/link', {
      headers: { authorization: `Bearer ${authToken}` },
      data: { code: token.code },
    })
    await expectOk(link)

    await expect(
      testPrisma().slackAccount.findUnique({
        where: { slackUserId: 'U123' },
      })
    ).resolves.toMatchObject({
      userId: user.id,
      teamId: 'T123',
    })
  })

  test('shows linked users their own bets', async ({ request }) => {
    const user = await createTestUser({ username: 'slack_better' })
    const market = await createOpenMarket()
    await testPrisma().slackAccount.create({
      data: { userId: user.id, slackUserId: 'U123', teamId: 'T123' },
    })
    await seedPendingBet({
      userId: user.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })

    const res = await postSlackCommand(request, { text: 'bets' })
    await expectOk(res)
    const body = await res.json()

    expect(body.response_type).toBe('ephemeral')
    expect(body.text).toContain('Your recent bets')
    expect(body.text).toContain('25 credits')
    expect(body.text).toContain('10:00 - 10:30')
  })

  test('renders markets and leaderboard summaries', async ({ request }) => {
    await createTestUser({ username: 'alpha' })
    await createTestUser({ username: 'beta' })

    const markets = await postSlackCommand(request, { text: 'markets' })
    await expectOk(markets)
    expect((await markets.json()).text).toContain('This week')

    const leaderboard = await postSlackCommand(request, { text: 'leaderboard' })
    await expectOk(leaderboard)
    expect((await leaderboard.json()).text).toContain('Leaderboard')
  })
})

test.describe('Slack betting and notifications', () => {
  test('places a bet from a Slack modal submission for a linked user', async ({ request }) => {
    const user = await createTestUser({ username: 'modal_better', credits: 100 })
    const market = await createOpenMarket()
    await testPrisma().slackAccount.create({
      data: { userId: user.id, slackUserId: 'U123', teamId: 'T123' },
    })

    const payload = {
      type: 'view_submission',
      team: { id: 'T123' },
      user: { id: 'U123' },
      view: {
        callback_id: 'wheresxi_place_bet',
        private_metadata: JSON.stringify({ slackUserId: 'U123', teamId: 'T123' }),
        state: {
          values: {
            market_day: {
              market_day: { selected_option: { value: market.id } },
            },
            granularity: {
              granularity: { selected_option: { value: 'HALF_HOUR' } },
            },
            minute: {
              minute: { value: '600' },
            },
            wager: {
              wager: { value: '25' },
            },
          },
        },
      },
    }
    const body = interactionBody(payload)
    const res = await request.post('/api/slack/interactions', {
      data: body,
      headers: signedSlackHeaders(body),
    })
    await expectOk(res)
    expect(await res.json()).toEqual({ response_action: 'clear' })

    const bet = await testPrisma().bet.findFirstOrThrow({
      where: { userId: user.id },
    })
    expect(bet).toMatchObject({
      marketDayId: market.id,
      granularity: 'HALF_HOUR',
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })
  })

  test('sends each market reminder once', async ({ request }) => {
    await ensureMarketDay('2026-04-28')
    const first = await request.post('/api/internal/slack/reminders', {
      headers: { 'x-internal-slack-secret': INTERNAL_SECRET },
      data: { kind: 'MARKET_OPEN', date: '2026-04-28' },
    })
    await expectOk(first)
    expect(await first.json()).toEqual({ sent: 1, skipped: 0 })

    const second = await request.post('/api/internal/slack/reminders', {
      headers: { 'x-internal-slack-secret': INTERNAL_SECRET },
      data: { kind: 'MARKET_OPEN', date: '2026-04-28' },
    })
    await expectOk(second)
    expect(await second.json()).toEqual({ sent: 0, skipped: 1 })

    await expect(testPrisma().slackNotificationLog.count()).resolves.toBe(1)
  })

  test('logs one settlement DM per linked settled bet', async ({ request }) => {
    await createTestUser({ username: 'settlement_admin', role: 'ADMIN' })
    const user = await createTestUser({ username: 'settled_slack_user' })
    const market = await ensureMarketDay('2026-04-28')
    await testPrisma().slackAccount.create({
      data: { userId: user.id, slackUserId: 'U123', teamId: 'T123' },
    })
    await seedPendingBet({
      userId: user.id,
      marketDayId: market.id,
      bucketStartMinute: 600,
      bucketEndMinute: 630,
      wager: 25,
    })

    const { token } = await loginAs(request, 'settlement_admin', TEST_PASSWORD)
    const res = await request.post('/api/admin/markets/resolve', {
      headers: { authorization: `Bearer ${token}` },
      data: { date: '2026-04-28', arrivedAtMinute: 615 },
    })
    await expectOk(res)

    await expect(
      testPrisma().slackNotificationLog.findFirst({
        where: { kind: 'BET_SETTLED', targetSlackId: 'U123' },
      })
    ).resolves.toMatchObject({
      targetSlackId: 'U123',
      targetId: expect.any(String),
    })
  })
})
