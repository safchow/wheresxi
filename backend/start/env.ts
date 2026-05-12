/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Application config
  |----------------------------------------------------------
  */
  DATABASE_URL: Env.schema.string(),
  ACCESS_TOKEN_TTL_DAYS: Env.schema.number.optional(),
  USER_STARTING_CREDITS: Env.schema.number.optional(),

  // Offices live in real time zones. All "current week" / market lock
  // calculations happen in this zone (default: Eastern Time).
  OFFICE_TIMEZONE: Env.schema.string.optional(),

  // Comma-separated list of allowed CORS origins.
  ALLOWED_ORIGINS: Env.schema.string.optional(),

  // Optional Redis URL for distributed rate limiting.
  REDIS_URL: Env.schema.string.optional(),

  // Slack companion app. Signing secret verifies inbound Slack requests;
  // bot token/channel/secret are only needed when Slack delivery is enabled.
  SLACK_SIGNING_SECRET: Env.schema.string.optional(),
  SLACK_BOT_TOKEN: Env.schema.string.optional(),
  SLACK_MARKET_CHANNEL_ID: Env.schema.string.optional(),
  SLACK_APP_BASE_URL: Env.schema.string.optional(),
  SLACK_INTERNAL_SECRET: Env.schema.string.optional(),
  SLACK_DISABLE_WEB_API: Env.schema.boolean.optional(),
})
