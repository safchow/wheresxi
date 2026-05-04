import { inject } from '@adonisjs/core'
import { randomBytes, createHash } from 'node:crypto'
import argon2 from 'argon2'
import { PrismaClient, type User, type Role } from '@prisma/client'
import env from '#start/env'
import ApiException from '#exceptions/api_exception'

export type PublicUser = {
  id: string
  username: string
  name: string
  email: string | null
  role: Role
  credits: number
  bankruptcies: number
  createdAt: Date
}

export type AuthResult = {
  user: PublicUser
  token: string
  expiresAt: Date | null
}

const TOKEN_BYTES = 40
const PASSWORD_MIN_LENGTH = 6
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/

@inject()
export default class AuthService {
  constructor(private prisma: PrismaClient) {}

  /** Strip everything sensitive before exposing a user over the wire. */
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      bankruptcies: user.bankruptcies,
      createdAt: user.createdAt,
    }
  }

  // ─── signup / login ────────────────────────────────────────────────────

  async signupWithInvite(input: {
    inviteToken: string
    username: string
    name: string
    password: string
  }): Promise<AuthResult> {
    this.assertValidUsername(input.username)
    this.assertValidPassword(input.password)
    const trimmedName = input.name.trim()
    if (!trimmedName) throw new ApiException('Name is required', { status: 422 })

    const startingCredits = env.get('USER_STARTING_CREDITS', 500)
    const passwordHash = await argon2.hash(input.password)

    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.inviteToken.findUnique({
        where: { token: input.inviteToken },
      })
      if (!invite) {
        throw new ApiException('Invite token is invalid', {
          status: 401,
          code: 'E_INVITE_INVALID',
        })
      }
      if (invite.revokedAt) {
        throw new ApiException('Invite token has been revoked', {
          status: 401,
          code: 'E_INVITE_REVOKED',
        })
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new ApiException('Invite token has expired', {
          status: 401,
          code: 'E_INVITE_EXPIRED',
        })
      }

      const existing = await tx.user.findUnique({
        where: { username: input.username },
      })
      if (existing) {
        throw new ApiException('Username is already taken', {
          status: 409,
          code: 'E_USERNAME_TAKEN',
        })
      }

      // Role flows from the invite, so admins can mint promote-to-admin
      // links without a separate manual step.
      const user = await tx.user.create({
        data: {
          username: input.username,
          name: trimmedName,
          passwordHash,
          credits: startingCredits,
          role: invite.grantsRole,
          usedInviteId: invite.id,
        },
      })

      const session = await this.issueAccessTokenForUser(user.id, tx)

      return {
        user: this.toPublicUser(user),
        token: session.token,
        expiresAt: session.expiresAt,
      }
    })
  }

  async login(input: {
    username: string
    password: string
  }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    })
    if (!user) {
      throw new ApiException('Invalid credentials', {
        status: 401,
        code: 'E_BAD_CREDENTIALS',
      })
    }
    // argon2.verify throws on malformed hashes. Treat that the same as a
    // wrong password so the API doesn't leak a 500 on auth attempts.
    let ok = false
    try {
      ok = await argon2.verify(user.passwordHash, input.password)
    } catch {
      ok = false
    }
    if (!ok) {
      throw new ApiException('Invalid credentials', {
        status: 401,
        code: 'E_BAD_CREDENTIALS',
      })
    }
    const session = await this.issueAccessTokenForUser(user.id)
    return {
      user: this.toPublicUser(user),
      token: session.token,
      expiresAt: session.expiresAt,
    }
  }

  async logout(tokenHash: string): Promise<void> {
    await this.prisma.accessToken.deleteMany({ where: { tokenHash } })
  }

  // ─── token helpers ─────────────────────────────────────────────────────

  /**
   * Generate a fresh bearer token for a user, persist its hash, and return
   * the plaintext token (sent to client once, never stored elsewhere).
   */
  async issueAccessTokenForUser(
    userId: string,
    txClient?: Pick<PrismaClient, 'accessToken'>,
  ): Promise<{ token: string; expiresAt: Date | null }> {
    const ttlDays = env.get('ACCESS_TOKEN_TTL_DAYS', 30)
    const token = `wxi_${randomBytes(TOKEN_BYTES).toString('hex')}`
    const tokenHash = AuthService.hashToken(token)
    const expiresAt =
      ttlDays && ttlDays > 0
        ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
        : null

    const client = txClient ?? this.prisma
    await client.accessToken.create({
      data: { userId, tokenHash, expiresAt },
    })
    return { token, expiresAt }
  }

  /**
   * Look up the user behind a bearer token. Returns null on miss.
   * Updates `lastUsedAt` on hit (best-effort, swallowed errors).
   */
  async getUserByToken(plaintextToken: string): Promise<User | null> {
    const tokenHash = AuthService.hashToken(plaintextToken)
    const record = await this.prisma.accessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
    if (!record) return null
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      // Best-effort cleanup of expired tokens
      await this.prisma.accessToken
        .delete({ where: { id: record.id } })
        .catch(() => {})
      return null
    }
    this.prisma.accessToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})
    return record.user
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  // ─── validation ────────────────────────────────────────────────────────

  private assertValidUsername(username: string): void {
    if (!USERNAME_REGEX.test(username)) {
      throw new ApiException(
        'Username must be 3–32 characters, letters/numbers/underscore only',
        { status: 422, code: 'E_USERNAME_INVALID' },
      )
    }
  }

  private assertValidPassword(password: string): void {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
      throw new ApiException(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
        { status: 422, code: 'E_PASSWORD_TOO_SHORT' },
      )
    }
  }
}
