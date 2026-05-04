import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AuditService from '#services/audit_service'
import InviteService from '#services/invite_service'
import { createInviteValidator } from '#validators/invite'
import ApiException from '#exceptions/api_exception'

@inject()
export default class AdminInvitesController {
  constructor(
    private invites: InviteService,
    private audit: AuditService,
  ) {}

  /** GET /api/admin/invites */
  async index(ctx: HttpContext) {
    const invites = await this.invites.listAll()
    return ctx.response.ok({ invites })
  }

  /** POST /api/admin/invites */
  async store(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const payload = await ctx.request.validateUsing(createInviteValidator)
    const invite = await this.invites.create({
      createdById: user.id,
      expiresInDays: payload.expiresInDays ?? null,
      note: payload.note ?? null,
      grantsRole: payload.grantsRole ?? 'USER',
    })
    await this.audit.log({
      adminId: user.id,
      action: 'CREATE_INVITE',
      targetType: 'InviteToken',
      targetId: invite.id,
      payload: {
        note: invite.note,
        expiresAt: invite.expiresAt,
        grantsRole: invite.grantsRole,
      },
    })
    return ctx.response.created({ invite })
  }

  /** DELETE /api/admin/invites/:id */
  async destroy(ctx: HttpContext) {
    const user = ctx.currentUser
    if (!user) throw new ApiException('Auth required', { status: 401 })
    const id = ctx.params.id as string
    await this.invites.revoke(id)
    await this.audit.log({
      adminId: user.id,
      action: 'REVOKE_INVITE',
      targetType: 'InviteToken',
      targetId: id,
    })
    return ctx.response.noContent()
  }
}
