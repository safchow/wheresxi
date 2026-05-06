import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

/**
 * Allowed origins are read from the `ALLOWED_ORIGINS` env var (CSV).
 *   ALLOWED_ORIGINS=http://localhost:5173,https://wheresxi.example
 *
 * If unset we default to the dev frontend so local work doesn't break.
 */
const raw = env.get('ALLOWED_ORIGINS', 'http://localhost:5173') ?? ''
const ALLOWED = raw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const corsConfig = defineConfig({
  enabled: true,
  origin: (origin) => {
    if (!origin) return false
    return ALLOWED.includes(origin)
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
