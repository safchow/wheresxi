import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { PrismaClient } from '@prisma/client'

/**
 *   node ace promote:admin <username>
 */
export default class PromoteAdmin extends BaseCommand {
  static commandName = 'promote:admin'
  static description = 'Promote a user to ADMIN'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Username to promote' })
  declare username: string

  async run() {
    const prisma = new PrismaClient()
    try {
      const user = await prisma.user.findUnique({
        where: { username: this.username },
      })
      if (!user) {
        this.logger.error(`No user with username "${this.username}".`)
        this.exitCode = 1
        return
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      })
      this.logger.success(`Promoted @${updated.username} to ${updated.role}.`)
    } finally {
      await prisma.$disconnect()
    }
  }
}
