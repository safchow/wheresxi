# Agent Guidance

## Changelog Maintenance

Any coding agent that pushes or opens a PR with user-facing behavior, product copy, visible bug fixes, auth/security behavior, or database schema changes that users/admins need to know about must also update `frontend/pages/ChangelogPage.tsx`.

- Add a new dated, versioned entry at the top of `CHANGELOG` for meaningful changes.
- Keep bullets high-level and user-readable.
- Do not add public changelog entries for internal-only work: CI, tests, package managers, npm/pnpm scripts, Dockerfile-only changes, docs-only changes, folder moves, formatting, or refactors with no observable product impact.
- If multiple related commits ship together, group them into one entry instead of adding one entry per commit.
