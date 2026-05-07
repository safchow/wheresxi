import { Card, CardContent } from '@/components/ui/card'

type ChangelogEntry = {
  version: string
  date: string
  title: string
  changes: string[]
}

// Keep this list current when shipping meaningful user-facing, deployment,
// schema, auth/security, or test coverage changes. See AGENTS.md.
const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v0.9.4',
    date: '2026-05-07',
    title: 'Per-service npm scripts',
    changes: [
      'Added explicit dev:frontend, dev:backend, build:frontend, build:backend, lint:frontend, lint:backend, test:frontend:unit, test:frontend:e2e, and test:backend:e2e scripts at the repo root.',
      'Updated the README so onboarding and local commands lead with the per-service names.',
      'Kept the unscoped aliases (dev, build, lint, test:unit, test:e2e) intact so the Dockerfile and CI workflows continue to work unchanged.',
    ],
  },
  {
    version: 'v0.9.3',
    date: '2026-05-07',
    title: 'Scaffold cleanup',
    changes: [
      'Removed unused Vite/React scaffold SVGs and the placeholder hero image.',
      'Removed unused shadcn exports (CardDescription, CardFooter, buttonVariants) so the UI surface only ships what the app actually uses.',
      'Removed the unused useWeekMarkets hook and the test that covered only it.',
    ],
  },
  {
    version: 'v0.9.2',
    date: '2026-05-07',
    title: 'Frontend client folder gets a clearer name',
    changes: [
      'Renamed frontend/api to frontend/client so the folder reads as the frontend HTTP client, not the backend service.',
      'Updated every frontend import and the matching unit test layout to follow the rename.',
    ],
  },
  {
    version: 'v0.9.1',
    date: '2026-05-06',
    title: 'Frontend query hooks get contract coverage',
    changes: [
      'Added fast unit tests that pin frontend query hook endpoints, payloads, and cache invalidation keys.',
      'Added a Vitest test command so query hook refactors can be checked without launching the browser.',
      'Added a frontend Vitest workflow so the unit suite runs on every pull request.',
    ],
  },
  {
    version: 'v0.9.0',
    date: '2026-05-06',
    title: 'Project folders get clearer names',
    changes: [
      'Renamed the React app folder from src to frontend.',
      'Renamed the Adonis API folder from api to backend.',
      'Updated build, test, deployment, and documentation references for the new layout.',
    ],
  },
  {
    version: 'v0.8.1',
    date: '2026-05-06',
    title: 'Theme toggle gets browser coverage',
    changes: [
      'Added a frontend Playwright test for the wallet theme toggle and cookie persistence.',
      'Added a separate frontend Playwright workflow so UI regression tests run on pull requests.',
    ],
  },
  {
    version: 'v0.8.0',
    date: '2026-05-06',
    title: 'Theme preferences get explicit',
    changes: [
      'Added a light/dark mode toggle to the wallet dropdown.',
      'Persisted theme preference in a cookie so the selected mode follows the user across visits.',
      'Defaulted new sessions to dark mode so light mode only appears when deliberately selected.',
    ],
  },
  {
    version: 'v0.7.0',
    date: '2026-05-06',
    title: 'Pull requests get automated checks',
    changes: [
      'Added a GitHub Actions workflow that runs the Playwright API test suite on pull requests.',
      'Provisioned a Postgres service in CI so database-backed API tests exercise migrations and real queries.',
    ],
  },
  {
    version: 'v0.6.0',
    date: '2026-05-06',
    title: 'Leaderboard tracks earned credits',
    changes: [
      'Changed leaderboard ranking from current wallet balance to credits earned from winning bets.',
      'Updated leaderboard labels so players see earned credits instead of current credits.',
      'Removed the Today, This week, and All-time leaderboard toggles so the board is always lifetime earned credits.',
    ],
  },
  {
    version: 'v0.5.0',
    date: '2026-05-05',
    title: 'Bankruptcy gets less exploitable',
    changes: [
      'Raised the bankruptcy reset to 500 credits so a fresh start actually feels fresh.',
      'Blocked bankruptcy filings while pending bets are still in flight.',
      'Kept the bankruptcy rules server-side so clever curl users cannot double-dip.',
    ],
  },
  {
    version: 'v0.4.0',
    date: '2026-05-04',
    title: 'Production hardening',
    changes: [
      'Made the web container listen on Railway\'s injected port to fix 502s in production.',
      'Added branch protection support with CODEOWNERS.',
      'Removed the bootstrap system user so fake accounts do not leak into leaderboards.',
      'Added an explicit leaderboard authentication regression test.',
    ],
  },
  {
    version: 'v0.3.0',
    date: '2026-05-04',
    title: 'Admin and invite polish',
    changes: [
      'Simplified deploy bootstrap with admin-grant invite links.',
      'Added a GitHub link in the footer.',
      'Cleaned up admin copy and footer navigation.',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-05-04',
    title: 'Leaderboard and market stability',
    changes: [
      'Removed noisy top stat cards from the leaderboard.',
      'Made weekly market creation race-safe under parallel dashboard requests.',
      'Refined the About, Login, and Rules copy.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-05-04',
    title: 'Initial wheresxi launch',
    changes: [
      'Built the full Taylor-arrival guessing game with credits, fixed multipliers, and weekly Tue/Wed/Thu markets.',
      'Added invite-only auth, admin resolution tools, refunds, bet cancellation, and bankruptcy.',
      'Shipped leaderboard, rewards, rules, about, previous-bets, and Taylor dossier pages.',
      'Added AdonisJS + Prisma + Postgres backend, Playwright API tests, Dockerfiles, and Railway deployment docs.',
    ],
  },
]

export function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
          Changelog
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          High-level notes for the people tracking Taylor infrastructure like
          it is a regulated exchange.
        </p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <Card key={entry.version}>
            <CardContent className="p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {entry.version}
                  </div>
                  <h2 className="text-lg font-semibold">{entry.title}</h2>
                </div>
                <time className="font-mono text-xs text-muted-foreground">
                  {entry.date}
                </time>
              </div>

              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
