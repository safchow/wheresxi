import { useState } from 'react'
import {
  ChevronDown,
  Coins,
  Loader2,
  LogOut,
  Receipt,
  Skull,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/dropdown'
import { useDeclareBankruptcy } from '@/api/queries'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'

export function Header() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const credits = user?.credits ?? 0

  const handleLogout = async () => {
    await logout()
    // Send users back to the root path so the URL bar matches what they see
    // (the login screen) and they're not stuck on /admin or /bets etc.
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">
            wheres<span className="text-no">xi</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          <NavLink to="/leaderboard" className={navLinkClass}>
            Leaderboard
          </NavLink>
          <NavLink to="/rewards" className={navLinkClass}>
            Rewards
          </NavLink>
          <NavLink to="/rules" className={navLinkClass}>
            Rules
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="ml-auto">
          <WalletMenu credits={credits} onLogout={handleLogout} />
        </div>
      </div>
    </header>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'transition hover:text-foreground',
    isActive && 'text-foreground font-medium',
  )
}

function WalletMenu({
  credits,
  onLogout,
}: {
  credits: number
  onLogout: () => Promise<void>
}) {
  const { user } = useAuth()
  const bankruptcy = useDeclareBankruptcy()
  const [error, setError] = useState<string | null>(null)
  const canFile = credits === 0

  async function handleBankruptcy(close: () => void) {
    setError(null)
    try {
      await bankruptcy.mutateAsync()
      close()
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not file')
    }
  }

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-3 py-1.5 transition hover:bg-secondary">
          <Coins className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-mono text-sm font-semibold tabular-nums">
            {credits.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">cr</span>
          <ChevronDown className="ml-0.5 h-3 w-3 text-muted-foreground" />
        </span>
      }
      contentClassName="w-64"
    >
      {(close) => (
        <>
          {user && (
            <>
              <DropdownLabel>Signed in as</DropdownLabel>
              <div className="px-2.5 pb-2 text-sm">
                <div className="font-medium">@{user.username}</div>
                <div className="text-xs text-muted-foreground">
                  {user.name || '—'}
                </div>
              </div>
              <DropdownSeparator />
            </>
          )}

          <DropdownLabel>Wallet</DropdownLabel>
          <div className="px-2.5 pb-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-mono tabular-nums">
                {credits.toLocaleString()} cr
              </span>
            </div>
            {user && user.bankruptcies > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Skull className="h-3 w-3" />
                  Bankruptcies
                </span>
                <span className="font-mono tabular-nums text-no">
                  {user.bankruptcies}
                </span>
              </div>
            )}
          </div>

          <DropdownSeparator />

          <NavLink
            to="/bets"
            onClick={close}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"
          >
            <Receipt className="h-3.5 w-3.5" />
            My bets
          </NavLink>

          <DropdownItem
            destructive
            disabled={!canFile || bankruptcy.isPending}
            onClick={() => handleBankruptcy(close)}
            title={
              canFile
                ? 'Reset to 500 cr · permanent stain on your reputation'
                : `Available once you hit 0 credits (you have ${credits})`
            }
          >
            {bankruptcy.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Skull className="h-3.5 w-3.5" />
            )}
            <span className="flex-1">
              Declare bankruptcy
              <span className="ml-1 text-[10px] text-muted-foreground">
                {canFile ? '(reset to 500 cr)' : `(${credits} cr left)`}
              </span>
            </span>
          </DropdownItem>

          {error && (
            <div className="mx-2 my-1 rounded-sm border border-no/40 bg-no/10 px-2 py-1 text-[11px] text-no">
              {error}
            </div>
          )}

          <DropdownSeparator />

          <DropdownItem
            onClick={async () => {
              await onLogout()
              close()
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  )
}
