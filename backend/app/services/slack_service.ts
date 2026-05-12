import { inject } from '@adonisjs/core'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  Prisma,
  PrismaClient,
  type Bet,
  type Granularity,
  type MarketDay,
  type SlackNotificationKind,
} from '@prisma/client'
import env from '#start/env'
import ApiException from '#exceptions/api_exception'
import BetService from '#services/bet_service'
import LeaderboardService from '#services/leaderboard_service'
import MarketService, { MULTIPLIERS, STEP_FOR_GRANULARITY } from '#services/market_service'

type SlackCommand = Record<string, unknown>

type SlackResponse = {
  response_type?: 'ephemeral' | 'in_channel'
  text: string
  blocks?: unknown[]
}

type SlackInteractionResponse =
  | { response_action: 'clear' }
  | { response_action: 'errors'; errors: Record<string, string> }
  | SlackResponse

const LINK_TTL_MINUTES = 15
const SIGNATURE_WINDOW_SECONDS = 60 * 5

@inject()
export default class SlackService {
  constructor(
    private prisma: PrismaClient,
    private marketService: MarketService,
    private betService: BetService,
    private leaderboardService: LeaderboardService
  ) {}

  verifySignature(rawBody: string, timestamp: string | undefined, signature: string | undefined) {
    const secret = env.get('SLACK_SIGNING_SECRET')
    if (!secret) {
      throw new ApiException('Slack signing secret is not configured', {
        status: 503,
        code: 'E_SLACK_NOT_CONFIGURED',
      })
    }
    const ts = Number(timestamp)
    if (
      !timestamp ||
      !Number.isInteger(ts) ||
      Math.abs(Date.now() / 1000 - ts) > SIGNATURE_WINDOW_SECONDS
    ) {
      throw this.signatureError()
    }
    if (!signature?.startsWith('v0=')) {
      throw this.signatureError()
    }
    const expected = `v0=${createHmac('sha256', secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex')}`
    if (!this.safeCompare(expected, signature)) {
      throw this.signatureError()
    }
  }

  async handleCommand(command: SlackCommand): Promise<SlackResponse> {
    const text = this.asString(command.text).trim()
    const [subcommand = 'help'] = text.split(/\s+/)
    switch (subcommand.toLowerCase()) {
      case '':
      case 'help':
        return this.help()
      case 'link':
        return this.createLinkResponse(command)
      case 'markets':
        return this.marketsResponse()
      case 'bets':
        return this.betsResponse(command)
      case 'leaderboard':
        return this.leaderboardResponse()
      case 'bet':
        return this.openBetModalResponse(command)
      default:
        return {
          response_type: 'ephemeral',
          text: `I don't know "${subcommand}". Try /wheresxi help.`,
        }
    }
  }

  async handleInteraction(payload: unknown): Promise<SlackInteractionResponse> {
    const data = payload as Record<string, any>
    if (data.type === 'block_actions') {
      const action = data.actions?.[0]
      if (action?.action_id === 'slack_open_bet_modal') {
        await this.openBetModal({
          triggerId: data.trigger_id,
          slackUserId: data.user?.id,
          teamId: data.team?.id,
          initialMarketDayId: action.value,
        })
        return {
          response_type: 'ephemeral',
          text: 'Opening the bet modal.',
        }
      }
    }

    if (data.type === 'view_submission' && data.view?.callback_id === 'wheresxi_place_bet') {
      try {
        await this.placeBetFromView(data)
        return { response_action: 'clear' }
      } catch (error) {
        if (error instanceof ApiException) {
          return {
            response_action: 'errors',
            errors: { wager: error.message },
          }
        }
        throw error
      }
    }

    return {
      response_type: 'ephemeral',
      text: 'That Slack action is no longer supported. Try /wheresxi help.',
    }
  }

  async linkAccount(userId: string, code: string) {
    const now = new Date()
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.slackLinkToken.findUnique({ where: { code } })
      if (!token || token.consumedAt || token.expiresAt <= now) {
        throw new ApiException('This Slack link has expired. Run /wheresxi link again.', {
          status: 410,
          code: 'E_SLACK_LINK_EXPIRED',
        })
      }

      const existingForSlack = await tx.slackAccount.findUnique({
        where: { slackUserId: token.slackUserId },
      })
      if (existingForSlack && existingForSlack.userId !== userId) {
        throw new ApiException('That Slack account is already linked to another wheresxi user.', {
          status: 409,
          code: 'E_SLACK_ALREADY_LINKED',
        })
      }
      const existingForUser = await tx.slackAccount.findUnique({
        where: { userId },
      })
      if (existingForUser && existingForUser.slackUserId !== token.slackUserId) {
        throw new ApiException('Your wheresxi account is already linked to another Slack user.', {
          status: 409,
          code: 'E_SLACK_USER_ALREADY_LINKED',
        })
      }

      const account = await tx.slackAccount.upsert({
        where: { userId },
        update: {
          slackUserId: token.slackUserId,
          teamId: token.teamId,
        },
        create: {
          userId,
          slackUserId: token.slackUserId,
          teamId: token.teamId,
        },
      })
      await tx.slackLinkToken.update({
        where: { id: token.id },
        data: { consumedAt: now },
      })
      return account
    })
  }

  async sendReminder(input: {
    kind: Extract<SlackNotificationKind, 'MARKET_OPEN' | 'MARKET_LOCK'>
    date: string
  }): Promise<{ sent: number; skipped: number }> {
    const channelId = env.get('SLACK_MARKET_CHANNEL_ID')
    if (!channelId) {
      throw new ApiException('Slack market channel is not configured', {
        status: 503,
        code: 'E_SLACK_NOT_CONFIGURED',
      })
    }
    if (!this.isWebApiConfigured()) {
      throw new ApiException('Slack bot token is not configured', {
        status: 503,
        code: 'E_SLACK_NOT_CONFIGURED',
      })
    }
    const date = MarketService.dateOnly(input.date)
    if (!this.isMarketWeekday(date)) {
      return { sent: 0, skipped: 1 }
    }
    await this.prisma.marketDay.upsert({
      where: { date },
      update: {},
      create: { date, status: 'OPEN' },
    })

    const targetId = `${input.kind}:${this.formatDate(date)}`
    const created = await this.createNotificationLog({
      kind: input.kind,
      targetId,
      targetSlackId: channelId,
      metadata: { date: this.formatDate(date) },
    })
    if (!created) return { sent: 0, skipped: 1 }

    await this.postMessage(
      channelId,
      input.kind === 'MARKET_OPEN'
        ? `Markets are open for ${this.formatDate(date)}. Use /wheresxi markets to see the board.`
        : `Market locks soon for ${this.formatDate(date)}. Get your bets in before midnight.`
    )
    return { sent: 1, skipped: 0 }
  }

  async notifySettlementForMarket(marketDayId: string): Promise<{ sent: number; skipped: number }> {
    if (!this.isWebApiConfigured()) return { sent: 0, skipped: 0 }

    const bets = await this.prisma.bet.findMany({
      where: {
        marketDayId,
        status: { in: ['WON', 'LOST', 'REFUNDED'] },
      },
      include: {
        marketDay: true,
        user: { include: { slackAccount: true } },
      },
    })

    let sent = 0
    let skipped = 0
    for (const bet of bets) {
      const slackAccount = bet.user.slackAccount
      if (!slackAccount) {
        skipped++
        continue
      }
      const created = await this.createNotificationLog({
        kind: 'BET_SETTLED',
        targetId: bet.id,
        targetSlackId: slackAccount.slackUserId,
        metadata: {
          status: bet.status,
          wager: bet.wager,
          payout: bet.payout,
          marketDate: this.formatDate(bet.marketDay.date),
        },
      })
      if (!created) {
        skipped++
        continue
      }
      await this.postMessage(slackAccount.slackUserId, this.settlementText(bet))
      sent++
    }
    return { sent, skipped }
  }

  private async createLinkResponse(command: SlackCommand): Promise<SlackResponse> {
    const slackUserId = this.required(command.user_id, 'Slack user')
    const teamId = this.required(command.team_id, 'Slack team')
    const code = randomBytes(18).toString('base64url')
    const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000)
    await this.prisma.slackLinkToken.create({
      data: { code, slackUserId, teamId, expiresAt },
    })
    const baseUrl = env.get('SLACK_APP_BASE_URL') ?? 'http://localhost:5173'
    return {
      response_type: 'ephemeral',
      text: `Link your wheresxi account here: ${baseUrl}/slack/link?code=${code}\nThis link expires in ${LINK_TTL_MINUTES} minutes.`,
    }
  }

  private async marketsResponse(): Promise<SlackResponse> {
    const markets = await this.marketService.listActiveWeek()
    const lines = markets.map((market) => {
      const locked = MarketService.isLocked(market)
      return `• ${this.formatDate(market.date)}: ${market.status}${locked ? ' (locked)' : ''}`
    })
    return {
      response_type: 'ephemeral',
      text: `This week:\n${lines.join('\n')}\n\nUse /wheresxi bet to place a guess.`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*This week:*\n${lines.join('\n')}` } },
        {
          type: 'actions',
          elements: markets.slice(0, 3).map((market) => ({
            type: 'button',
            text: { type: 'plain_text', text: `Bet ${this.formatDate(market.date)}` },
            action_id: 'slack_open_bet_modal',
            value: market.id,
          })),
        },
      ],
    }
  }

  private async betsResponse(command: SlackCommand): Promise<SlackResponse> {
    const account = await this.linkedAccount(command)
    if (!account) return this.linkPrompt()
    const bets = await this.betService.listMyBets(account.userId, 5)
    if (bets.length === 0) {
      return { response_type: 'ephemeral', text: 'You have no bets yet. Try /wheresxi markets.' }
    }
    const lines = bets.map(
      (bet) => `• ${this.betLabel(bet)} — ${bet.wager} credits — ${bet.status}`
    )
    return {
      response_type: 'ephemeral',
      text: `Your recent bets:\n${lines.join('\n')}`,
    }
  }

  private async leaderboardResponse(): Promise<SlackResponse> {
    const rows = await this.leaderboardService.listTop(10)
    const lines = rows.length
      ? rows.map((row) => `${row.rank}. ${row.username}: ${row.creditsEarned} earned`)
      : ['No leaderboard rows yet.']
    return {
      response_type: 'ephemeral',
      text: `Leaderboard:\n${lines.join('\n')}`,
    }
  }

  private async openBetModalResponse(command: SlackCommand): Promise<SlackResponse> {
    const account = await this.linkedAccount(command)
    if (!account) return this.linkPrompt()
    await this.openBetModal({
      triggerId: this.asString(command.trigger_id),
      slackUserId: account.slackUserId,
      teamId: account.teamId,
    })
    return {
      response_type: 'ephemeral',
      text: 'Opening the bet modal. If nothing appears, make sure the Slack bot token is configured.',
    }
  }

  private async openBetModal(input: {
    triggerId: string
    slackUserId: string
    teamId: string
    initialMarketDayId?: string
  }) {
    if (!input.triggerId) return
    const markets = await this.marketService.listActiveWeek()
    const initial = input.initialMarketDayId ?? markets[0]?.id
    const view = {
      type: 'modal',
      callback_id: 'wheresxi_place_bet',
      private_metadata: JSON.stringify({
        slackUserId: input.slackUserId,
        teamId: input.teamId,
      }),
      title: { type: 'plain_text', text: 'Place a bet' },
      submit: { type: 'plain_text', text: 'Bet' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'input',
          block_id: 'market_day',
          label: { type: 'plain_text', text: 'Market day' },
          element: {
            type: 'static_select',
            action_id: 'market_day',
            initial_option: this.optionForMarket(
              markets.find((m) => m.id === initial) ?? markets[0]
            ),
            options: markets.map((market) => this.optionForMarket(market)),
          },
        },
        {
          type: 'input',
          block_id: 'granularity',
          label: { type: 'plain_text', text: 'Granularity' },
          element: {
            type: 'static_select',
            action_id: 'granularity',
            initial_option: this.option('Half hour (2x)', 'HALF_HOUR'),
            options: [
              this.option('Half hour (2x)', 'HALF_HOUR'),
              this.option('Quarter hour (4x)', 'QUARTER_HOUR'),
              this.option('Five minute (12x)', 'FIVE_MIN'),
              this.option('Exact minute (60x)', 'EXACT'),
            ],
          },
        },
        {
          type: 'input',
          block_id: 'minute',
          label: { type: 'plain_text', text: 'Start minute or exact minute' },
          element: {
            type: 'plain_text_input',
            action_id: 'minute',
            placeholder: { type: 'plain_text', text: '600 for 10:00' },
          },
        },
        {
          type: 'input',
          block_id: 'wager',
          label: { type: 'plain_text', text: 'Wager' },
          element: {
            type: 'plain_text_input',
            action_id: 'wager',
            placeholder: { type: 'plain_text', text: '25' },
          },
        },
      ],
    }
    await this.slackApi('views.open', {
      trigger_id: input.triggerId,
      view,
    })
  }

  private async placeBetFromView(payload: Record<string, any>) {
    const metadata = this.parseMetadata(payload.view?.private_metadata)
    const slackUserId = metadata.slackUserId || payload.user?.id
    const account = await this.prisma.slackAccount.findUnique({ where: { slackUserId } })
    if (!account)
      throw new ApiException('Link your account with /wheresxi link first.', { status: 401 })

    const values = payload.view?.state?.values ?? {}
    const marketDayId = values.market_day?.market_day?.selected_option?.value
    const granularity = values.granularity?.granularity?.selected_option?.value as Granularity
    const minute = Number(values.minute?.minute?.value)
    const wager = Number(values.wager?.wager?.value)
    if (!marketDayId || !granularity || !Number.isInteger(minute) || !Number.isInteger(wager)) {
      throw new ApiException('Choose a market, granularity, minute, and whole-number wager.', {
        status: 422,
        code: 'E_BAD_SLACK_BET',
      })
    }

    const step = granularity === 'EXACT' ? null : STEP_FOR_GRANULARITY[granularity]
    await this.betService.placeBet({
      userId: account.userId,
      marketDayId,
      granularity,
      wager,
      ...(granularity === 'EXACT'
        ? { exactMinute: minute }
        : { bucketStartMinute: minute, bucketEndMinute: minute + step! }),
    })
    await this.postMessage(
      slackUserId,
      `Bet placed: ${wager} credits at ${MULTIPLIERS[granularity]}x for ${MarketService.formatTime(minute)}.`
    )
  }

  private help(): SlackResponse {
    return {
      response_type: 'ephemeral',
      text: [
        '*wheresxi Slack commands*',
        '• /wheresxi link — connect Slack to your wheresxi account',
        '• /wheresxi markets — show this week’s markets',
        '• /wheresxi bet — open the bet modal',
        '• /wheresxi bets — show your recent bets',
        '• /wheresxi leaderboard — show the top players',
      ].join('\n'),
    }
  }

  private linkPrompt(): SlackResponse {
    return {
      response_type: 'ephemeral',
      text: 'Link your account first with /wheresxi link.',
    }
  }

  private async linkedAccount(command: SlackCommand) {
    const slackUserId = this.asString(command.user_id)
    if (!slackUserId) return null
    return this.prisma.slackAccount.findUnique({ where: { slackUserId } })
  }

  private optionForMarket(market?: MarketDay) {
    return this.option(market ? this.formatDate(market.date) : 'No markets', market?.id ?? 'none')
  }

  private option(text: string, value: string) {
    return { text: { type: 'plain_text', text }, value }
  }

  private betLabel(bet: Bet & { marketDay?: MarketDay }) {
    const day = bet.marketDay ? this.formatDate(bet.marketDay.date) : 'unknown day'
    if (bet.granularity === 'EXACT') {
      return `${day} at ${MarketService.formatTime(bet.exactMinute ?? 0)}`
    }
    return `${day} ${MarketService.formatTime(bet.bucketStartMinute ?? 0)} - ${MarketService.formatTime(bet.bucketEndMinute ?? 0)}`
  }

  private settlementText(bet: Bet & { marketDay: MarketDay }) {
    const base = `${this.formatDate(bet.marketDay.date)} bet settled: ${bet.status}`
    if (bet.status === 'WON') return `${base}. You won ${bet.payout} credits.`
    if (bet.status === 'REFUNDED') return `${base}. Your ${bet.wager} credits were refunded.`
    return `${base}. Better luck next market.`
  }

  private async createNotificationLog(input: {
    kind: SlackNotificationKind
    targetId: string
    targetSlackId: string
    metadata?: Prisma.InputJsonValue
  }) {
    try {
      await this.prisma.slackNotificationLog.create({ data: input })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false
      }
      throw error
    }
  }

  private async postMessage(channel: string, text: string) {
    await this.slackApi('chat.postMessage', { channel, text })
  }

  private async slackApi(method: string, payload: Record<string, unknown>) {
    if (env.get('SLACK_DISABLE_WEB_API')) return
    const token = env.get('SLACK_BOT_TOKEN')
    if (!token) return
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) {
      throw new ApiException(`Slack API ${method} failed: ${body.error ?? res.statusText}`, {
        status: 502,
        code: 'E_SLACK_API',
      })
    }
  }

  private parseMetadata(raw: string | undefined) {
    if (!raw) return {} as Record<string, string>
    try {
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {} as Record<string, string>
    }
  }

  private isMarketWeekday(date: Date) {
    const day = date.getUTCDay()
    return day >= 2 && day <= 4
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10)
  }

  private isWebApiConfigured() {
    return Boolean(env.get('SLACK_DISABLE_WEB_API') || env.get('SLACK_BOT_TOKEN'))
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value : ''
  }

  private required(value: unknown, label: string) {
    const str = this.asString(value)
    if (!str) throw new ApiException(`${label} is required`, { status: 422 })
    return str
  }

  private signatureError() {
    return new ApiException('Invalid Slack signature', {
      status: 401,
      code: 'E_SLACK_SIGNATURE',
    })
  }

  private safeCompare(expected: string, actual: string) {
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(actual)
    return (
      expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
    )
  }
}
