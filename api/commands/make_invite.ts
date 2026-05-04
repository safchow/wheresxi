import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'

/**
 * Bootstrap helper: mint a signup invite without going through the admin UI.
 *
 *   node ace make:invite                       (USER invite, no expiry)
 *   node ace make:invite --admin               (mints an ADMIN-grant invite)
 *   node ace make:invite --frontend=http://localhost:5173
 *   node ace make:invite --user=<username>     (set a specific creator)
 */
export default class MakeInvite extends BaseCommand {
  static commandName = 'make:invite'
  static description = 'Create a reusable signup invite token'
  static options: CommandOptions = { startApp: true }

  @args.string({
    required: false,
    description: 'Optional note to attach to the invite',
  })
  declare note?: string

  @flags.string({ description: 'Frontend base URL for the signup link' })
  declare frontend?: string

  @flags.string({
    description: 'Username of an existing user to mark as creator (else first user wins)',
  })
  declare user?: string

  @flags.number({ description: 'Days until expiry (omit for no expiry)' })
  declare expires?: number

  @flags.boolean({
    description: 'Mint an invite that grants ADMIN role to the new user',
  })
  declare admin?: boolean

  async run() {
    const prisma = new PrismaClient()
    try {
      let creator = this.user
        ? await prisma.user.findUnique({ where: { username: this.user } })
        : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })

      if (!creator) {
        creator = await prisma.user.upsert({
          where: { username: 'system' },
          update: {},
          create: {
            username: 'system',
            name: 'wheresxi system',
            passwordHash: 'disabled',
            role: 'ADMIN',
            credits: 0,
          },
        })
        this.logger.info('No users yet — created a `system` user to own this invite.')
      }

      const token = `inv_${randomBytes(16).toString('hex')}`
      const expiresAt =
        this.expires && this.expires > 0
          ? new Date(Date.now() + this.expires * 24 * 60 * 60 * 1000)
          : null
      const grantsRole = this.admin ? 'ADMIN' : 'USER'

      await prisma.inviteToken.create({
        data: {
          token,
          createdById: creator.id,
          note: this.note ?? null,
          expiresAt,
          grantsRole,
        },
      })

      const base = this.frontend ?? 'http://localhost:5173'
      this.logger.success('Invite created.')
      this.logger.info(`token : ${token}`)
      this.logger.info(`grants: ${grantsRole}`)
      this.logger.info(`link  : ${base}/signup?inviteToken=${token}`)
    } finally {
      await prisma.$disconnect()
    }
  }
}
