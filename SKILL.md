# Skill: Shipping end-to-end full-stack apps

A framework-agnostic playbook for turning a rough product idea into a deployed,
tested, production-shaped app. Use it to keep scope clear, work in phases, and
let tests drive implementation instead of being added as an afterthought.

## When to invoke this skill

Use when a user asks to build or evolve a small-to-medium full-stack app:
backend, frontend, database, auth, tests, CI, deployment, docs, and API tooling.
It is especially relevant when requirements are being discovered through
conversation and the work may need multiple pull requests.

Do not use this for:
- Single-purpose CLIs or scripts
- Pure refactors with no product behavior
- Work where the user already gave a detailed implementation spec

## Operating principles

- **Test-driven by default.** New behavior starts with a test or executable
  contract. Confirm the test fails for the expected reason, implement the
  smallest change, then refactor after green.
- **Framework choices are implementation details.** Prefer generic patterns:
  API framework, ORM, migration tool, query/cache layer, e2e runner, deployment
  target. Use project-specific names only when working in an existing repo.
- **Small, reviewable PRs.** Split tests, scaffolding, refactors, and feature
  behavior when they can be reviewed independently.
- **Service boundaries stay clear.** Each service should own its source,
  tests, config, Dockerfile, package manifest, and runtime docs. Root files
  should be orchestration, repo metadata, or shared workspace config.
- **Verify where the risk is.** Run the narrowest meaningful test first, then
  broader checks before pushing.

## Phase 0: Scope and constraints

- Identify the product slice being shipped and the smallest useful version.
- Clarify service layout, auth model, persistence needs, deployment target,
  and first-admin/bootstrap flow when those are not already decided.
- Record what will be tested at API, UI, and deployment boundaries.
- If the work is larger than one reviewable PR, split the plan before coding.

## Phase 1: Test plan and contracts

- Define the observable contracts before implementation:
  - API routes: method, path, auth, request body, response shape, error shape.
  - UI flows: user action, visible result, persistence, and failure state.
  - Data changes: migration result, defaults, uniqueness, and state transitions.
  - Deployment/tooling: build command, runtime env, smoke-test command.
- Write failing tests for the first behavior slice. Match test level to risk:
  - API behavior: integration/e2e tests against the real app and isolated DB.
  - Browser behavior: browser e2e tests.
  - Query/cache behavior: hook or client contract tests.
  - Pure helpers: focused unit tests.
- Prefer fixtures and table-driven tests over repeated boilerplate.

## Phase 2: Data model and backend

- Model important state transitions as enums, not booleans.
- Keep controllers thin: validate input, call a service, return a response.
- Put business logic in services or domain modules, not route handlers.
- Wrap multi-row mutations in transactions.
- Add idempotency and conflict guards for operations that settle, refund,
  revoke, cancel, or otherwise flip state.
- Add audit logs for admin-only or sensitive mutations.
- Keep validation schemas close to the API boundary and reusable from tests.
- Use explicit timezone handling for any user-facing date/week/day logic.
- Re-run the failing contract test, then adjacent backend tests.

## Phase 3: Frontend integration

- Use one typed client layer for HTTP calls and error parsing.
- Let the query/cache layer own server state; local storage should only persist
  durable client values like tokens or preferences.
- Use hierarchical query keys so mutations can invalidate by subtree.
- Keep loading states stable when tabs or filters change query parameters.
- Derive render-time defaults synchronously when possible; avoid effect-driven
  state that causes a visible second render.
- Add browser or hook-level tests for the behavior before wiring broad UI.

## Phase 4: API tooling and docs

- Keep API exploration collections alongside the backend service.
- Organize request files by route/domain, with one request per endpoint.
- Use environment variables for base URLs, tokens, IDs, and common inputs.
- Document setup flows that humans actually need: signup/login, first admin,
  auth token handling, common IDs to copy between requests.
- Update public docs when behavior changes; skip public changelog entries for
  internal-only tooling.

## Phase 5: CI, deployment, and release

- Each service should have a local command for typecheck/build/test.
- CI should run the checks that protect the changed surface area.
- Dockerfiles should be multi-stage and locally smoke-tested when changed.
- Migrations should run in the deployment flow appropriate to the stack.
- Frontend values baked into bundles should be build-time config, not assumed
  runtime env.
- Deployment docs should include required env vars, build args, bootstrap flow,
  and post-deploy smoke tests.

## Communication patterns

- Use todos for multi-step implementation work and update them as work moves.
- Before editing, say what is changing and why.
- After a phase, summarize what was verified, what remains, and any blocker.
- If CI or local verification fails, report the failing command and the next
  concrete fix.
- Keep final summaries short: outcome, verification, PR link if created, and
  any real risk or follow-up.

## Done checklist

- The requested behavior is covered by a failing-first test or executable
  contract.
- Relevant tests pass locally.
- Typecheck/build pass for touched services when applicable.
- No secrets, tokens, local env edits, or generated artifacts are staged.
- Public changelog entries, if any, are user-facing.
- Docs or API collections are updated when API behavior changes.
