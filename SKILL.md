# Skill: Shipping vibe-coded full-stack apps that don't suck

A playbook for going from "rough idea + a couple Slack jokes" to a deployed,
tested, production-shaped app **without losing energy to bikeshedding or
backtracking**. Framework-agnostic on tech choices, opinionated on process.

## When to invoke this skill

Use when a user asks to build a small-to-medium full-stack app from scratch —
backend + frontend + DB + auth + tests + deployment. Especially relevant when
they're vibe-coding (no spec, evolving requirements, frequent direction
changes) and the surface area will keep growing.

Do **not** use this for:
- Single-purpose CLIs / scripts
- Pure refactors of existing systems
- Anything where the user has already produced a detailed spec — defer to the
  spec instead

## Core principles (don't violate)

1. **Confirm the make-or-break decisions before touching code.** Use the
   `AskQuestion` tool to nail down 3–5 architectural pivots (project layout,
   auth strategy, deployment target, starting state) at the very start of
   any multi-hour task. Wrong defaults cost hours of rework.
2. **Phase the work; verify between phases.** Each phase ends with a green
   build/test before the next starts. Never queue up 4 hours of changes and
   hope they all compose.
3. **Honesty over hype.** When asked "is this production ready?", give a
   structured no with the actual gaps, not a smiling yes.
4. **Iterate on the simplest thing that works.** Add complexity only when the
   user actually needs it. The user often asks for a simpler version of what
   you built — pre-empt them by starting simpler.
5. **The user is steering. You're driving.** Don't push back on their
   parody/joke premise, their tone, or their UX preferences. Those are theirs.
   Push back only on architectural mistakes that will cost them time later.

## The phases

For a greenfield full-stack ship:

### Phase 0 — Lock the decisions

Always ask, before any code:

- **Project layout** — sibling repos vs. monorepo (subdir)
- **Auth strategy** — DB-backed access tokens vs. stateless JWT vs. sessions
- **Bootstrap admin** — seed in migration vs. ace command vs. manual SQL
- **Starting state defaults** — credits, balances, whatever the equivalent is
- **Scope** — phase-1 only, phases 1+2, all the way through

Use `AskQuestion` for these. **Multiple choice, with each option spelling out
the trade-off in plain English.** Don't ask open-ended questions (the user
will pick something you weren't expecting and you'll have to redesign).

### Phase 1 — Scaffold + DB + schema

- Stand up the API framework with the leanest starter kit available.
- Pick an ORM, install it, define the **whole schema** for the v1 surface in
  one shot (types, enums, relations). Don't dribble migrations.
- Get the DB running locally via Docker Compose — single `docker compose up
  -d` to start. Always non-default ports (`5433` not `5432`) so it doesn't
  conflict with whatever else the user has installed.
- Run the first migration. Verify it succeeded. Ship.

### Phase 2 — Auth, middleware, observability hooks

- Build the auth service: signup, login, me, logout. Hash passwords properly
  (argon2 or scrypt). Store tokens hashed too (sha256 is fine for opaque
  tokens) so a DB dump doesn't leak live sessions.
- Add request-scoped middleware: auth (token → currentUser) and role (gate
  by enum). Apply at the route group level, not per-route.
- Rate limiting — at least three named throttles: signup, auth/login, general
  API. Memory store is fine for dev; make sure there's a Redis-backed option
  for prod.
- Wire a typed exception class (`ApiException` w/ `status`, `code`,
  `message`) and a global handler that turns it into a stable JSON envelope:
  `{ error: { code, message, errors? } }`. Front-end depends on this shape.
- Validation lives in a separate `validators/` directory, not inside
  controllers.

### Phase 3 — Domain

- Services own all business logic. Controllers are 5–15 lines: parse input,
  call service, return response.
- **Anything that mutates more than one row goes in a transaction.** Bet
  placement, market resolution, refunds, bankruptcy resets — all of these
  must be atomic.
- **Add idempotency guards on operations that flip state.** "Already
  resolved" / "already settled" should return 409 with a stable error code,
  not silently re-do the work.
- **Audit log table for admin-only mutations.** Cheap to add up front,
  expensive to retrofit. Single table: `(adminId, action, targetType,
  targetId, payload, createdAt)`.
- Time-zone awareness from day one if the domain has any concept of
  "today" / "this week" / "midnight". Use a real TZ library
  (`date-fns-tz`, `Temporal`). Never `getUTCDay()` for user-facing weeks.

### Phase 4 — Frontend integration

- One typed API client (`apiClient.get/post/delete`) that adds the bearer
  header and parses the JSON envelope into typed errors.
- TanStack Query (or equivalent) for server state. **Hierarchical query
  keys** so you can invalidate by prefix (`['market', 'today', granularity]`
  → invalidate all of `['market']` after a mutation).
- Mutations declare which keys they invalidate. Be liberal — invalidating an
  unused key is free.
- Auth is a hook (`useAuth`) over the `me` query, not a context wrapper. The
  query cache is the source of truth; localStorage just holds the bearer
  token.
- For tab/list components that switch sub-views (granularity tabs, time
  ranges, filters), use **`placeholderData: keepPreviousData`** + **lift the
  switching UI out of the loading conditional.** Otherwise switching causes
  a full layout collapse on every cache miss.
- For pages that show multiple parallel slices (e.g., 4 granularities of the
  same data), use `useQueries` to fire all on mount and only poll the
  active one. Switching tabs becomes a cache read.

### Phase 5 — Tests

- Default to **integration tests over unit tests.** Test the actual HTTP
  contract: real request → real DB → real response. They're slower but they
  catch real bugs.
- Set up an **isolated test DB** on the same DB server, separate database
  name. Apply migrations to it. Truncate every table in `beforeEach` for
  hermetic tests. Pre-flight setup script for CI.
- Test fixtures, not boilerplate: `createTestUser`, `loginAs`, `expectOk`,
  `expectErrorCode`. A test should read like its English description.
- **Table-driven tests for parametric coverage.** Especially for things like
  "every admin route returns 401 unauthenticated and 403 as a regular user".
  One table, two test factories, full coverage.
- For tests that exercise time-based logic (locked markets, expired tokens),
  generate **future or past data** rather than mocking the clock. The
  fixtures `createOpenMarket()` / `createLockedMarket()` pattern works
  cleanly.
- **Disable rate limits in test env.** Otherwise the suite trips its own
  throttles when running in parallel.
- **Run the suite at the end of every phase.** Not "when the user asks." Not
  "before deploy." After every meaningful change. Faster than guessing.

### Phase 6 — Deployment

- **Multi-stage Dockerfile per service.** Build stage installs everything,
  runtime stage is tiny.
- Run migrations on startup (`prisma migrate deploy && node bin/server.js`
  or equivalent). Do NOT do this from CI — the deployed binary owns its own
  schema.
- Sensible defaults in the image (`NODE_ENV`, `PORT`, `LOG_LEVEL`) so a
  deploy doesn't fail the first time someone forgets an env var.
- **Frontend uses build args, not runtime envs**, for any value that gets
  baked into the bundle. Document this loudly — it's the most common
  deploy footgun.
- A `DEPLOY.md` with a recipe for the chosen platform. Include the bootstrap
  flow ("how do I create the first admin?"). Include the post-deploy
  smoke-test commands.
- Smoke-test the actual built image locally (`docker run -p ...`) before
  declaring done. Catches missing env vars, broken migrations, and
  permission issues that won't show up in `npm run dev`.

## Communication patterns

### Use TodoWrite for any task with 3+ steps

Update todos in real time. Mark in-progress when you start, completed when
done, never both at once. Visible progress is calming for the user.

### Phased completion summaries

After each phase, print a summary:
- What's working (verified)
- What's left
- Anything you ran into

Keep it short. The user wants to know they're not on fire, not read prose.

### Pre-flight reviews

Before deploys, run a structured "what's left" check covering:
- 🔴 Must-fix blockers
- ⚠️ Worth knowing about
- 💡 Nice follow-ups

This is also when you flag the deployment footguns (build args, CORS
allowlist, first admin bootstrap, etc.).

### When the user asks "is this production ready?"

Always answer **honestly with structure**:
- Things that would bite within a week (deal-breakers)
- Things that work today but won't tomorrow
- Things that are actually solid

Don't lead with vague affirmations. The honest "no, here's what's missing"
is what they're asking for.

## Implementation patterns I keep reaching for

### `CodeName / Type / Status` enums everywhere

Make every important state transition an enum, not a boolean. `BetStatus =
PENDING | WON | LOST | REFUNDED | CANCELLED`. Adding a new state later is a
migration; flipping a boolean is a refactor.

### Cross-component state without prop drilling

When two siblings need to share state that doesn't belong in the parent (e.g.
"which bucket is selected for this day at this granularity"), use a
**module-level Map + listener set + force-rerender hook**. Cleaner than
context providers for narrow shared state.

```ts
const store = new Map<string, T>()
const listeners = new Map<string, Set<() => void>>()

function useStoreEntry(key: string): [T | null, (v: T) => void] {
  const [, force] = useState(0)
  useEffect(() => subscribe(key, () => force(n => n + 1)), [key])
  return [store.get(key) ?? null, (v) => { store.set(key, v); notify(key) }]
}
```

### Compute defaults synchronously, not in `useEffect`

If a hook returns a default value when state is missing, compute it during
render and write it to the store before returning. Otherwise the consuming
component renders once with `null`, then again after the effect fires —
visible flicker.

### Guard against malformed DB data on read paths

Bootstrap users with placeholder hashes, soft-deleted rows, etc. — wrap any
external call that throws on bad input (`argon2.verify`) in try/catch and
return the polite failure mode. A 500 on `/login` should be impossible.

### Hierarchical query keys

```ts
queryKeys.market.root                    // invalidate every market query
queryKeys.market.week(granularity)       // one specific granularity
queryKeys.market.exactMinute(id, m)      // one specific minute
```

After a mutation: `invalidateQueries({ queryKey: queryKeys.market.root })`
busts the whole subtree. No need to remember every individual key.

### `keepPreviousData` for tab-driven UIs

Anywhere the user clicks a tab to switch a query parameter, this option turns
the cache miss from "everything disappears" to "data dims for 100ms then
swaps in." Free win.

## Common pitfalls (and how I worked around them in practice)

1. **Adonis `.env.[NODE_ENV]` parallel race.** Setting `DATABASE_URL` in
   `.env.test` doesn't reliably win over `.env` because both files are
   loaded in parallel. Set the env via the **command line** (cross-env,
   webServer.command) so it's already in `process.env` when the loader runs.

2. **Prisma 7 dropped `url = env(DATABASE_URL)` in schema.prisma.** Pin to
   Prisma 6 unless you're ready to write adapters.

3. **Vite's dep cache (`node_modules/.vite`) gets stale across major
   dependency swaps** (e.g., uninstalling Redux, installing TanStack). Wipe
   it and restart the dev server when modules fail with "blocked because of
   a disallowed MIME type" or similar weirdness.

4. **`erasableSyntaxOnly: true` in TS configs forbids parameter property
   shorthand** (`constructor(readonly status: number)`). Either disable the
   flag or declare fields explicitly. The error message is unhelpful.

5. **`useQuery` returning the same data object reference is required for
   `useSyncExternalStore`.** If you write a custom auth/store hook that
   returns a new object every render, consumers will re-render on every
   tick. Memoize.

6. **Per-test database state via `BEGIN/ROLLBACK` doesn't work** with
   Adonis/Prisma because the API process holds its own connection pool. Use
   `TRUNCATE TABLE ... CASCADE` in a `beforeEach` instead.

## Decision framework: when to refactor mid-session

When the user requests a feature that doesn't fit the current data model:

| Situation                                    | Do                                              |
| -------------------------------------------- | ----------------------------------------------- |
| New optional field                           | Add column, ship migration, no concern          |
| New required state transition                | New enum value, migration, audit existing data  |
| New entity that owns existing data           | New table + relation, migrate FK pointers       |
| Concept the schema fundamentally lacks       | Stop. Surface the trade-off to the user. Get permission. |
| User wants to undo previously-shipped state  | SQL rollback transaction, then resume the API   |

The last row is important: the dev DB is going to get into weird states
during vibe coding. Don't be precious about it. SQL transactions to revert
prior payouts/refunds and re-resolve are fine, frequent, and faster than
trying to design around it in advance.

## Anti-patterns I avoid

- **Designing for a user count we don't have.** This thing is for 50
  coworkers, not 50,000 customers. Skip horizontal scaling concerns until
  there's evidence they matter.
- **Premature observability.** No Sentry, no OTel, no APM until something
  has actually gone wrong twice. Pino → stdout → platform logs is enough.
- **Over-validating on the frontend.** The backend is the source of truth.
  The frontend's job is to send well-formed requests and render whatever
  comes back, not to second-guess server validation.
- **Generating code that wraps trivial things.** A two-line fetch is a
  two-line fetch. It does not need a `BaseService` or a `useFetch`.
- **Renaming things mid-session because a better name occurred to me.**
  Resist. The user has the old name in their muscle memory.

## Tone

Match the user's tone. If they're vibe-coding a parody, the copy should be
deadpan, the comments should be lightly funny, the error messages can have
personality. If they're shipping a serious product, dial it back.

Never be preachy. The README's `License: Don't.` works because it's one
line; explaining why would have killed it.

## Final smell check before you call something done

- [ ] `npm run typecheck` clean (or equivalent)
- [ ] Test suite green
- [ ] No leftover `console.log` / `// TODO` / debug branches
- [ ] No new files that nothing imports (delete dead code as you go)
- [ ] User-visible copy doesn't contradict the actual behavior
- [ ] If you added a new env var, it's in `.env.example` and `DEPLOY.md`
- [ ] If you added a new admin action, it goes through the audit log
- [ ] If you added a new mutation, the relevant query keys are invalidated

If any of these miss, the next session's user is going to find them.

---

Most of this isn't novel. The point is **doing all of it consistently** so
the app survives 30+ rounds of "actually, can we change…" without rotting.
