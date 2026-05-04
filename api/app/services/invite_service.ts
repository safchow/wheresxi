import { inject } from '@adonisjs/core'
import { randomBytes } from 'node:crypto'
import { PrismaClient, type InviteToken, type Role } from '@prisma/client'
import ApiException from '#exceptions/api_exception'

/**
 * Shape sent to the admin UI: each invite carries its creator (null only
 * for bootstrap invites minted before any user existed) and the list of
 * users who've redeemed it (zero or more, with timestamps so the UI can
 * render "claimed by @x · 2 days ago"). We also surface a `usageCount`
 * because Postgres can compute it cheaper than the UI tallying an array.
 */
export type InviteWithRelations = InviteToken & {
  createdBy: { id: string; username: string } | null
  usages: { id: string; username: string; createdAt: Date }[]
  usageCount: number
}

@inject()
export default class InviteService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a reusable invite token.
   *
   * - `createdById`    null for bootstrap invites minted on a fresh deploy
   *                    (no users exist yet); always set when minted from
   *                    the admin UI.
   * - `expiresInDays`  null/undefined → never expires.
   * - `grantsRole`     'USER' | 'ADMIN' (default USER). Lets admins mint
   *                    invites that promote new users straight to admin
   *                    without an extra manual step.
   *
   * Invites stay valid until an admin revokes them (or they expire) — there
   * is no per-invite redemption cap.
   */
  async create(input: {
    createdById?: string | null
    expiresInDays?: number | null
    note?: string | null
    grantsRole?: Role | null
  }): Promise<InviteToken> {
    const token = `inv_${randomBytes(16).toString('hex')}`
    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null
    return this.prisma.inviteToken.create({
      data: {
        token,
        createdById: input.createdById ?? null,
        expiresAt,
        note: input.note ?? null,
        grantsRole: input.grantsRole ?? 'USER',
      },
    })
  }

  async listAll(): Promise<InviteWithRelations[]> {
    const rows = await this.prisma.inviteToken.findMany({
      include: {
        createdBy: { select: { id: true, username: true } },
        usages: {
          select: { id: true, username: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => ({ ...row, usageCount: row.usages.length }))
  }

  /**
   * Soft-delete an invite: set revokedAt so existing claimers stay linked
   * but no future signups can use the token. Refuses if the invite is
   * already revoked (so the audit log doesn't double-count REVOKE_INVITE).
   */
  async revoke(id: string): Promise<void> {
    const invite = await this.prisma.inviteToken.findUnique({ where: { id } })
    if (!invite) {
      throw new ApiException('Invite not found', { status: 404 })
    }
    if (invite.revokedAt) {
      throw new ApiException('Invite is already revoked', {
        status: 409,
        code: 'E_INVITE_ALREADY_REVOKED',
      })
    }
    await this.prisma.inviteToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }
}
