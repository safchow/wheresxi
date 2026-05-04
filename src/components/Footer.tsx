import { Link } from 'react-router-dom'

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
        <div className="flex flex-wrap gap-4">
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <a href="#" className="hover:text-foreground">
            Taylor (please arrive)
          </a>
        </div>
      </div>
    </footer>
  )
}
