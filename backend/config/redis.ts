import { defineConfig } from '@adonisjs/redis'
import { type InferConnections } from '@adonisjs/redis/types'
import env from '#start/env'

const redisUrl = env.get('REDIS_URL')

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: redisUrl
      ? // Connect via URL string when REDIS_URL is set.
        ({
          connectionName: 'main',
          // ioredis accepts a URL via the first arg or the `host`/`port`/etc.
          // We pass the URL through `lazyConnect` style: it goes into the
          // `host` (which ioredis treats as URL string when it parses).
          // The simpler path: use `URL` to extract host/port/password.
          ...(() => {
            const u = new URL(redisUrl)
            return {
              host: u.hostname,
              port: Number(u.port || 6379),
              password: u.password || undefined,
              username: u.username || undefined,
              db: 0,
            }
          })(),
        } as never)
      : ({
          host: '127.0.0.1',
          port: 6379,
          password: undefined,
          db: 0,
        } as never),
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
