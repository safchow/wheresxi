import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SlackService from '#services/slack_service'
import ApiException from '#exceptions/api_exception'

@inject()
export default class SlackController {
  constructor(private slack: SlackService) {}

  async commands(ctx: HttpContext) {
    this.verify(ctx)
    const response = await this.slack.handleCommand(ctx.request.all())
    return ctx.response.ok(response)
  }

  async interactions(ctx: HttpContext) {
    this.verify(ctx)
    const payload = ctx.request.input('payload')
    if (typeof payload !== 'string') {
      throw new ApiException('Missing Slack interaction payload', {
        status: 422,
        code: 'E_SLACK_PAYLOAD',
      })
    }
    const response = await this.slack.handleInteraction(JSON.parse(payload))
    return ctx.response.ok(response)
  }

  async link(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const code = ctx.request.input('code')
    if (typeof code !== 'string' || !code.trim()) {
      throw new ApiException('Slack link code is required', {
        status: 422,
        code: 'E_SLACK_LINK_CODE',
      })
    }
    const account = await this.slack.linkAccount(user.id, code.trim())
    return ctx.response.ok({
      slackAccount: {
        id: account.id,
        slackUserId: account.slackUserId,
        teamId: account.teamId,
      },
    })
  }

  async reminders(ctx: HttpContext) {
    const configuredSecret = process.env.SLACK_INTERNAL_SECRET
    if (!configuredSecret) {
      throw new ApiException('Slack internal secret is not configured', {
        status: 503,
        code: 'E_SLACK_NOT_CONFIGURED',
      })
    }
    if (ctx.request.header('x-internal-slack-secret') !== configuredSecret) {
      throw new ApiException('Forbidden', { status: 403, code: 'E_FORBIDDEN' })
    }
    const kind = ctx.request.input('kind')
    const date = ctx.request.input('date')
    if ((kind !== 'MARKET_OPEN' && kind !== 'MARKET_LOCK') || typeof date !== 'string') {
      throw new ApiException('Reminder kind and date are required', {
        status: 422,
        code: 'E_SLACK_REMINDER',
      })
    }
    return ctx.response.ok(await this.slack.sendReminder({ kind, date }))
  }

  private verify(ctx: HttpContext) {
    const raw = ctx.request.raw()
    this.slack.verifySignature(
      typeof raw === 'string' ? raw : '',
      ctx.request.header('x-slack-request-timestamp'),
      ctx.request.header('x-slack-signature')
    )
  }
}
