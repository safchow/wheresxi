import vine from '@vinejs/vine'

export const createInviteValidator = vine.compile(
  vine.object({
    expiresInDays: vine.number().min(1).max(365).optional().nullable(),
    note: vine.string().trim().maxLength(160).optional().nullable(),
    // Defaults to USER server-side. Admins can mint promote-to-admin invites
    // by passing 'ADMIN' here.
    grantsRole: vine.enum(['USER', 'ADMIN']).optional().nullable(),
  }),
)
