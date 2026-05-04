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
├── api/                         AdonisJS 6 + Prisma + Postgres + Redis backend
│   ├── app/
│   │   ├── controllers/         Thin: parse → service → response
│   │   ├── services/            All business logic, IoC-injected
│   │   ├── middleware/          auth, role
│   │   ├── validators/          VineJS schemas
│   │   └── exceptions/          Typed ApiException + JSON envelope
│   ├── prisma/                  Schema + migrations
│   ├── start/                   Routes, kernel, env, limiter
│   ├── tests/e2e/               86 Playwright API integration tests
│   ├── commands/                node ace make:invite / promote:admin
│   ├── docker-compose.yml       Local Postgres on :5433
│   └── Dockerfile               Multi-stage build, runs migrations on boot
└── src/                         React + Vite + Tailwind + shadcn-style frontend
    ├── api/                     Typed fetch client + TanStack Query hooks
    ├── components/              MainMarket, MyActiveBets, TaylorDossier, …
    ├── pages/                   Home, MyBets, Leaderboard, Admin, Login, Signup, …
    └── hooks/useAuth.tsx        Token-storage + me-query wrapper

Dockerfile                       Frontend image (Vite build → nginx)
nginx.conf                       SPA fallback + cache headers
DEPLOY.md                        Step-by-step Railway recipe
```

## Stack

| Layer        | Choice                                           |
| ------------ | ------------------------------------------------ |
| Frontend     | React 19 · Vite · Tailwind · TanStack Query v5   |
| Routing      | react-router-dom                                 |
| Backend      | AdonisJS 6 · Prisma 6 · VineJS · argon2          |
| Storage      | PostgreSQL 16 · Redis (rate limiter, optional)   |
| Tests        | Playwright (`@playwright/test`) — API only       |
| Auth         | DB-backed bearer tokens (`wxi_…`), sha256-hashed |
| Time zone    | `America/Toronto` via `date-fns-tz`              |

## Local development

### Prereqs

- Node 22 (`nvm use 22.22.0`)
- Docker Desktop
- npm

### One-time setup

```bash
# 1. Postgres
cd api
docker compose up -d                    # postgres on localhost:5433

# 2. Backend deps + schema
npm install
npx prisma migrate dev                  # applies migrations to wheresxi DB

# 3. Frontend deps
cd ..
npm install
```

### Run

```bash
# Backend (in api/)
npm run dev                             # http://localhost:3333

# Frontend (in repo root)
npm run dev                             # http://localhost:5173
```

### Bootstrap your first user

There's no seed admin. From `api/`:

```bash
node ace make:invite                    # mints invite, prints signup link
# Visit the printed URL, sign up.
node ace promote:admin <username>       # gives you ADMIN
```

You can also run that as a SQL one-liner if you'd rather not use the ace
CLI — see `DEPLOY.md` for the snippet.

### Useful commands

| Where    | Command                                | What                                   |
| -------- | -------------------------------------- | -------------------------------------- |
| `api/`   | `npm run dev`                          | API on :3333 with HMR                  |
| `api/`   | `npm run typecheck`                    | tsc --noEmit                           |
| `api/`   | `npm run test:e2e`                     | Playwright suite (~9s, 86 tests)       |
| `api/`   | `npm run test:e2e:setup`               | Apply migrations to `wheresxi_test`    |
| `api/`   | `npx prisma studio`                    | DB GUI (uses `.env`)                   |
| `api/`   | `node ace make:invite`                 | Mint a signup invite                   |
| `api/`   | `node ace promote:admin <username>`    | Promote a user to ADMIN                |
| root     | `npm run dev`                          | Frontend on :5173                      |
| root     | `npm run build`                        | tsc + vite build                       |

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

| Name        | Allowance         | Block on exhaustion |
| ----------- | ----------------- | ------------------- |
| `signup`    | 4 per 10 min / IP | 1 hour              |
| `auth`      | 8 per minute / IP | 5 minutes           |
| `api`       | 120/min/user (or IP if logged-out) | none |

Switches to a Redis-backed store automatically when `REDIS_URL` is set.
Disabled entirely when `NODE_ENV=test`.

## Testing

```bash
cd api
npm run test:e2e                         # full suite
npm run test:e2e -- auth.spec.ts         # one file
npm run test:e2e -- -g "bankruptcy"      # by name
```

The Playwright config spawns a separate AdonisJS instance on **:3334**
against an isolated `wheresxi_test` database. Each test truncates every
table in `beforeEach`, so suites are hermetic.

Coverage:

| File                     | Tests | Covers                                  |
| ------------------------ | ----- | --------------------------------------- |
| `auth.spec.ts`           | 14    | signup/login/me/logout + invite errors  |
| `bets.spec.ts`           | 22    | place/cancel + lock + credit guardrails |
| `admin.spec.ts`          | 18    | role gate × 7 routes + resolve/refund/invites/audit |
| `market.spec.ts`         | 9     | weekly markets + exact minute           |
| `leaderboard.spec.ts`    | 4     | ranking + range filter                  |
| `stats.spec.ts`          | 4     | dossier shape + math                    |
| `bankruptcy.spec.ts`     | 5     | broke-only filing + reset               |

## Environment

`api/.env` (see `.env.example` for the full list):

| Var                       | Default                  | Notes                            |
| ------------------------- | ------------------------ | -------------------------------- |
| `DATABASE_URL`            | local Postgres           | Required.                        |
| `APP_KEY`                 | _none_                   | Required. 32+ random chars.      |
| `OFFICE_TIMEZONE`         | `America/Toronto`        | All week + lock math uses this.  |
| `ALLOWED_ORIGINS`         | `http://localhost:5173`  | CSV. CORS allowlist.             |
| `REDIS_URL`               | _none_                   | Falls back to in-memory limiter. |
| `ACCESS_TOKEN_TTL_DAYS`   | `30`                     |                                  |
| `USER_STARTING_CREDITS`   | `500`                    |                                  |
| `BANKRUPTCY_RESET_CREDITS`| `100`                    | Only filable at exactly 0 cr.    |

Frontend reads one build-time arg:

| Var                  | Default                  |
| -------------------- | ------------------------ |
| `VITE_API_BASE_URL`  | `http://localhost:3333`  |

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) for the full Railway recipe. TL;DR:

```
Postgres plugin ──┐
                  ├─→ wheresxi-api  (Dockerfile, root: api/)
Redis plugin    ──┤
                  └─→ wheresxi-web  (Dockerfile, root: ./)
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
