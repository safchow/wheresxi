import { defineConfig, stores } from '@adonisjs/limiter'
import type { InferLimiters } from '@adonisjs/limiter/types'
import env from '#start/env'

/**
 * If `REDIS_URL` is set we use the redis-backed store so multiple API
 * instances share rate-limit state. Falls back to in-memory for local dev.
 */
const useRedis = !!env.get('REDIS_URL')

const limiterConfig = defineConfig({
  default: useRedis ? 'redis' : 'memory',
  stores: {
    memory: stores.memory({}),
    redis: stores.redis({
      connectionName: 'main',
      rejectIfRedisNotReady: false,
    }),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
