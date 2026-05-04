import { inject } from '@adonisjs/core'
import {
  Prisma,
  PrismaClient,
  type AdminAction,
  type AdminLog,
} from '@prisma/client'

/**
 * Anything an admin does that mutates state goes through here. Service
 * methods can pass an existing `tx` so the log entry shares the parent
 * transaction (preferred) or omit it for a standalone write.
 */
export type AuditWritable = {
  adminId: string
  action: AdminAction
  targetType?: string | null
  targetId?: string | null
  payload?: Prisma.InputJsonValue | null
}

@inject()
export default class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(input: AuditWritable, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma
    await client.adminLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        payload:
          (input.payload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      },
    })
  }

  async listRecent(
    limit = 100,
  ): Promise<Array<AdminLog & { admin: { id: string; username: string } }>> {
    return this.prisma.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { id: true, username: true } } },
    })
  }
}
