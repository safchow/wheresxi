import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'

const isTest = env.get('NODE_ENV') === 'test'

/**
 * Named HTTP rate-limit middlewares. Apply by attaching to routes:
 *   router.post('/auth/login', ...).use([throttleAuth])
 *
 * In `NODE_ENV=test` we short-circuit each definition so the suite can
 * hammer the API without tripping production limits.
 */
export const throttleAuth = limiter.define('auth', () =>
  isTest
    ? null
    : limiter.allowRequests(8).every('1 minute').blockFor('5 minutes'),
)

export const throttleSignup = limiter.define('signup', () =>
  isTest
    ? null
    : limiter.allowRequests(4).every('10 minutes').blockFor('1 hour'),
)

export const throttleApi = limiter.define('api', (ctx) => {
  if (isTest) return null
  const key = ctx.currentUser?.id
    ? `user:${ctx.currentUser.id}`
    : `ip:${ctx.request.ip()}`
  return limiter.allowRequests(120).every('1 minute').usingKey(key)
})
