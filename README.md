# wheresxi

A prediction market for one (1) guy named Taylor.

Bet credits on what time he'll arrive at the office. Tuesday, Wednesday,
Thursday only — Mondays and Fridays he is "working from home." We checked
his Steam activity. He is not.

> Not affiliated with Kalshi or the CFTC. Credits are not legal tender in
> any jurisdiction. Just vibes.

## What's in the box

```
.
├── backend/                     AdonisJS 6 + Prisma + Postgres + Redis backend
│   ├── app/
│   │   ├── controllers/         Thin: parse → service → response
│   │   ├── services/            All business logic, IoC-injected
│   │   ├── middleware/          auth, role
│   │   ├── validators/          VineJS schemas
│   │   └── exceptions/          Typed ApiException + JSON envelope
│   ├── prisma/                  Schema + migrations
│   ├── start/                   Routes, kernel, env, limiter
│   ├── tests/e2e/               101 Playwright API integration tests
│   ├── commands/                node ace make:invite / promote:admin
│   ├── docker-compose.yml       Local Postgres on :5433
│   └── Dockerfile               Multi-stage build, runs migrations on boot
├── frontend/                    React + Vite + Tailwind + shadcn-style frontend
│   ├── client/                  Typed fetch client + TanStack Query hooks
│   ├── components/              MainMarket, MyActiveBets, TaylorDossier, …
│   ├── pages/                   Home, MyBets, Leaderboard, Admin, Login, Signup, …
│   ├── hooks/useAuth.tsx        Token-storage + me-query wrapper
│   ├── tests/                   Vitest unit + Playwright frontend suites
│   ├── Dockerfile               Vite build → nginx, deployed as wheresxi-web
│   └── nginx.conf               SPA fallback + cache headers
├── package.json                 Thin orchestrator — pnpm filters into frontend/ + backend/
├── pnpm-workspace.yaml          Declares frontend + backend as workspaces
├── pnpm-lock.yaml               Single lockfile covering both workspaces
├── DEPLOY.md                    Step-by-step Railway recipe
└── railway.toml                 Railway service hints
```

## Stack

| Layer     | Choice                                           |
| --------- | ------------------------------------------------ |
| Frontend  | React 19 · Vite · Tailwind · TanStack Query v5   |
| Routing   | react-router-dom                                 |
| Backend   | AdonisJS 6 · Prisma 6 · VineJS · argon2          |
| Storage   | PostgreSQL 16 · Redis (rate limiter, optional)   |
| Tests     | Vitest + Playwright (`@playwright/test`)         |
| Auth      | DB-backed bearer tokens (`wxi_…`), sha256-hashed |
| Time zone | `America/Toronto` via `date-fns-tz`              |
| Tooling   | pnpm workspace (corepack) · Node 22              |

## Local development

### Prereqs

- Node 22 (`nvm use 22.22.0`)
- Docker Desktop
- pnpm (`corepack enable` activates the version pinned in `package.json`)

### One-time setup

```bash
# 1. Postgres
cd backend
docker compose up -d                    # postgres on localhost:5433

# 2. Install both workspaces from the repo root
cd ..
pnpm install                            # one root install covers both services

# 3. Apply schema
cd backend
pnpm exec prisma migrate dev            # applies migrations to wheresxi DB
```

### Run

From the repo root:

```bash
pnpm dev:backend                         # API on http://localhost:3333
pnpm dev:frontend                        # frontend on http://localhost:5173
```

Both scripts are thin wrappers — `pnpm dev:frontend` calls
`pnpm --filter frontend dev`, `pnpm dev:backend` calls
`pnpm --filter backend dev`. You can also `cd frontend` / `cd backend`
and run the unscoped scripts directly (`pnpm dev`, etc).

### Test Slack locally

The Slack app is a companion for the core workflows: account linking,
market summaries, recent bets, leaderboard, modal-based bet placement, market
open/lock reminders, and settlement DMs.

1. Create a Slack app at <https://api.slack.com/apps>.
2. Add bot scopes: `commands`, `chat:write`, `chat:write.public`, and
   `users:read`.
3. Install the app to your workspace and copy the **Bot User OAuth Token**.
4. From the repo root, expose the backend with ngrok:
   ```bash
   ngrok http 3333
   ```
5. In the Slack app settings:
   - Slash command: `/wheresxi`
   - Request URL: `https://<ngrok-domain>/api/slack/commands`
   - Interactivity Request URL: `https://<ngrok-domain>/api/slack/interactions`
6. Add these to `backend/.env`:
   ```bash
   SLACK_SIGNING_SECRET=<basic-information-signing-secret>
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_MARKET_CHANNEL_ID=<channel-id-for-reminders>
   SLACK_APP_BASE_URL=http://localhost:5173
   SLACK_INTERNAL_SECRET=<random-local-secret>
   ```
7. Restart `pnpm dev:backend`, then run `/wheresxi link` in Slack. Open the
   returned link while logged in locally, confirm linking, then try
   `/wheresxi markets`, `/wheresxi bet`, `/wheresxi bets`, and
   `/wheresxi leaderboard`.

To test a reminder locally:

```bash
curl -X POST http://localhost:3333/api/internal/slack/reminders \
  -H "content-type: application/json" \
  -H "x-internal-slack-secret: $SLACK_INTERNAL_SECRET" \
  -d '{"kind":"MARKET_OPEN","date":"2026-04-28"}'
```

### Bootstrap your first user

There's no seed admin. From `backend/`:

```bash
node ace make:invite                    # mints invite, prints signup link
# Visit the printed URL, sign up.
node ace promote:admin <username>       # gives you ADMIN
```

You can also run that as a SQL one-liner if you'd rather not use the ace
CLI — see `DEPLOY.md` for the snippet.

### Useful commands

Run all of these from the repo root unless noted.

| Command                                           | What                                |
| ------------------------------------------------- | ----------------------------------- |
| `pnpm install`                                    | Install both workspaces in one shot |
| `pnpm dev:frontend`                               | Frontend on :5173                   |
| `pnpm dev:backend`                                | API on :3333 with HMR               |
| `pnpm build:frontend`                             | tsc + vite build                    |
| `pnpm build:backend`                              | Adonis production build             |
| `pnpm lint:frontend`                              | ESLint over `frontend/`             |
| `pnpm lint:backend`                               | ESLint over `backend/`              |
| `pnpm typecheck:frontend`                         | tsc --build (frontend)              |
| `pnpm typecheck:backend`                          | tsc --noEmit (backend)              |
| `pnpm test:frontend:unit`                         | Vitest frontend unit suite          |
| `pnpm test:frontend:e2e`                          | Playwright frontend suite           |
| `pnpm test:backend:e2e`                           | Playwright API suite                |
| `pnpm test:backend:e2e:setup`                     | Apply migrations to `wheresxi_test` |
| `cd backend && pnpm exec prisma studio`           | DB GUI (uses `backend/.env`)        |
| `cd backend && node ace make:invite`              | Mint a signup invite                |
| `cd backend && node ace promote:admin <username>` | Promote a user to ADMIN             |

The root `package.json` has zero dependencies — it's a thin orchestrator
that delegates every command to either workspace via `pnpm --filter`.
The `pnpm-workspace.yaml` declares `frontend` and `backend` as the two
workspaces; one root install is all you need.

## Architecture

### Bet lifecycle

1. **Place** — `POST /api/bets`. Wager is debited from `User.credits` and
   the multiplier is locked in. Bet is `PENDING`.
2. **Lock** — every market locks at `00:00 America/Toronto` on its date.
   `placeBet` and `cancelBet` reject after that with `E_MARKET_LOCKED`.
3. **Cancel** (optional, before lock) — `DELETE /api/bets/:id`. Wager
   returned, bet → `CANCELLED`.
4. **Resolve** — admin posts `arrivedAtMinute` or `bustReason`. Each
   `PENDING` bet becomes `WON` (paid out wager × multiplier) or `LOST`.
5. **Refund** (admin escape hatch) — voids a market: every `PENDING` bet
   is returned and marked `REFUNDED`.

All transitions are wrapped in a single Prisma transaction.

### Admin actions are audited

Every `RESOLVE_MARKET` / `REFUND_MARKET` / `CREATE_INVITE` /
`REVOKE_INVITE` writes a row to `AdminLog` with the actor, target, and a
JSON payload. Read it from `GET /api/admin/audit` (admin-only) or directly
from the table.

### Rate limiting

`@adonisjs/limiter` with three named throttles:

| Name     | Allowance                          | Block on exhaustion |
| -------- | ---------------------------------- | ------------------- |
| `signup` | 4 per 10 min / IP                  | 1 hour              |
| `auth`   | 8 per minute / IP                  | 5 minutes           |
| `api`    | 120/min/user (or IP if logged-out) | none                |

Switches to a Redis-backed store automatically when `REDIS_URL` is set.
Disabled entirely when `NODE_ENV=test`.

## Testing

From the repo root:

```bash
pnpm test:frontend:unit                              # frontend hook/unit contracts
pnpm test:frontend:e2e                               # frontend Playwright suite
pnpm test:backend:e2e                                # backend API Playwright suite
pnpm test:backend:e2e -- auth.spec.ts                # one backend file
pnpm test:backend:e2e -- -g "bankruptcy"             # backend filter by test name
```

The Playwright config spawns a separate AdonisJS instance on **:3334**
against an isolated `wheresxi_test` database. Each test truncates every
table in `beforeEach`, so suites are hermetic.

Coverage:

| File                  | Tests | Covers                                                       |
| --------------------- | ----- | ------------------------------------------------------------ |
| `auth.spec.ts`        | 16    | signup/login/me/logout + invite errors                       |
| `bets.spec.ts`        | 20    | place/cancel + lock + credit guardrails                      |
| `admin.spec.ts`       | 32    | role gate × 7 routes + resolve/refund/invites/audit          |
| `market.spec.ts`      | 10    | weekly markets + exact minute                                |
| `leaderboard.spec.ts` | 4     | ranking + range filter                                       |
| `stats.spec.ts`       | 4     | dossier shape + math                                         |
| `bankruptcy.spec.ts`  | 7     | broke-only filing + reset                                    |
| `slack.spec.ts`       | 8     | Slack signatures, linking, commands, betting, reminders, DMs |

## Environment

`backend/.env` (see `.env.example` for the full list):

| Var                       | Default                 | Notes                                                           |
| ------------------------- | ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`            | local Postgres          | Required.                                                       |
| `APP_KEY`                 | _none_                  | Required. 32+ random chars.                                     |
| `OFFICE_TIMEZONE`         | `America/Toronto`       | All week + lock math uses this.                                 |
| `ALLOWED_ORIGINS`         | `http://localhost:5173` | CSV. CORS allowlist.                                            |
| `REDIS_URL`               | _none_                  | Falls back to in-memory limiter.                                |
| `ACCESS_TOKEN_TTL_DAYS`   | `30`                    |                                                                 |
| `USER_STARTING_CREDITS`   | `500`                   |                                                                 |
| `SLACK_SIGNING_SECRET`    | _none_                  | Required for Slack slash commands/interactions.                 |
| `SLACK_BOT_TOKEN`         | _none_                  | Required for opening modals and posting DMs/channel messages.   |
| `SLACK_MARKET_CHANNEL_ID` | _none_                  | Channel for market open/lock reminders.                         |
| `SLACK_APP_BASE_URL`      | `http://localhost:5173` | Base URL used in `/wheresxi link` responses.                    |
| `SLACK_INTERNAL_SECRET`   | _none_                  | Shared secret for scheduler-triggered Slack reminder jobs.      |
| `SLACK_DISABLE_WEB_API`   | `false`                 | Test-only switch that logs notifications without calling Slack. |

Frontend reads one build-time arg:

| Var                 | Default                 |
| ------------------- | ----------------------- |
| `VITE_API_BASE_URL` | `http://localhost:3333` |

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) for the full Railway recipe. TL;DR:

```
Postgres plugin ──┐
                  ├─→ wheresxi-api  (Dockerfile, root: backend/)
Redis plugin    ──┤
                  └─→ wheresxi-web  (Dockerfile, root: frontend/)
                                    build arg: VITE_API_BASE_URL
```

After both deploy, `railway run --service=wheresxi-api node ace make:invite`
to bootstrap your first user.

## Rules

Eight of them, all on `/rules`. The summary:

- Markets run **Tue/Wed/Thu** between 9:00 AM and 10:30 AM ET.
- Guesses lock at midnight ET on the day of.
- Payouts: half-hour 2× · 15-min 4× · 5-min 12× · exact minute 60×.
- Bust conditions: arrives before 9, after 10:30, or WFH/sick → everyone busts.
- Insider trading is allowed and encouraged. Do not tamper with Taylor.
- Out of credits? Declare bankruptcy for a fresh 100. Reputation damaged
  forever.

## License

Don't.

## Honest disclaimer

This entire app is purely vibe coded. Not a single line of code was
reviewed.
