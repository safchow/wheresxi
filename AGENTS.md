# Agent Guidance

## Changelog Maintenance

Any coding agent that pushes or opens a PR with user-facing behavior, product copy, deployment behavior, security/auth logic, database schema, or test coverage changes must also update `src/pages/ChangelogPage.tsx`.

- Add a new dated, versioned entry at the top of `CHANGELOG` for meaningful changes.
- Keep bullets high-level and user-readable.
- Skip changelog updates only for purely invisible maintenance, such as typo-only comments, formatting-only changes, or internal refactors with no observable impact.
- If multiple related commits ship together, group them into one entry instead of adding one entry per commit.
