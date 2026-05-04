import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    inviteToken: vine.string().trim().minLength(8).maxLength(128),
    username: vine
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,32}$/),
    name: vine.string().trim().minLength(1).maxLength(80),
    password: vine.string().minLength(6).maxLength(256),
  }),
)

export const loginValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(1).maxLength(64),
    password: vine.string().minLength(1).maxLength(256),
  }),
)
