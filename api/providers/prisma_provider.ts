import type { ApplicationService } from '@adonisjs/core/types'
import { PrismaClient } from '@prisma/client'

/**
 * Provides a singleton Prisma client to the IoC container so services can
 * resolve it via constructor injection.
 */
export default class PrismaProvider {
  static prismaClient: PrismaClient | null = null

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(PrismaClient, () => {
      const client = new PrismaClient({
        log: this.app.inProduction ? ['error'] : ['error', 'warn'],
      })
      PrismaProvider.prismaClient = client
      return client
    })
  }

  async ready() {
    const client = await this.app.container.make(PrismaClient)
    await client.$connect()
  }

  async shutdown() {
    if (PrismaProvider.prismaClient) {
      await PrismaProvider.prismaClient.$disconnect()
      PrismaProvider.prismaClient = null
    }
  }
}
