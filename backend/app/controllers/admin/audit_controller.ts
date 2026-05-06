import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AuditService from '#services/audit_service'

@inject()
export default class AdminAuditController {
  constructor(private audit: AuditService) {}

  /** GET /api/admin/audit — most recent admin actions, newest first */
  async index(ctx: HttpContext) {
    const entries = await this.audit.listRecent(200)
    return ctx.response.ok({ entries })
  }
}
