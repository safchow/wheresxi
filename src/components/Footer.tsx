import { Link } from 'react-router-dom'

// Lucide dropped brand marks, so we inline the GitHub octocat SVG.
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <div>
            A prediction market for one (1) guy. Not affiliated with Kalshi,
            or the CFTC.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <a
            href="https://github.com/safchow/wheresxi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
            aria-label="wheresxi on GitHub"
          >
            <GitHubIcon className="h-3.5 w-3.5" />
            GitHub
          </a>
          <a href="#" className="hover:text-foreground">
            Taylor (please arrive)
          </a>
        </div>
      </div>
    </footer>
  )
}
