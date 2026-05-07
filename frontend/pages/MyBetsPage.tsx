import { useMemo, useState } from 'react'
import {
  Loader2,
  Receipt,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Undo2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCancelBet, useMyBets } from '@/client/queries'
import { extractApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Bet, BetStatus } from '@/client/types'

type Filter = 'all' | 'pending' | 'settled'

const STATUS_LABEL: Record<BetStatus, string> = {
  PENDING: 'Pending',
  WON: 'Won',
  LOST: 'Lost',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

const STATUS_COLOR: Record<BetStatus, string> = {
  PENDING: 'border-border bg-secondary text-foreground',
  WON: 'border-yes/40 bg-yes/10 text-yes',
  LOST: 'border-no/40 bg-no/10 text-no',
  REFUNDED: 'border-amber-400/40 bg-amber-400/10 text-amber-500',
  CANCELLED: 'border-border bg-muted text-muted-foreground',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatDay(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${DAY_NAMES[d.getUTCDay()]} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function formatTime(min: number) {
  const h24 = Math.floor(min / 60)
  const mm = min % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm.toString().padStart(2, '0')}`
}

function describeBet(bet: Bet) {
  if (bet.granularity === 'EXACT') {
    return `${formatTime(bet.exactMinute ?? 0)} AM exact`
  }
  if (bet.bucketStartMinute != null && bet.bucketEndMinute != null) {
    return `${formatTime(bet.bucketStartMinute)} – ${formatTime(bet.bucketEndMinute)}`
  }
  return '—'
}

export function MyBetsPage() {
  const { data, isLoading, isError, error } = useMyBets()
  const [filter, setFilter] = useState<Filter>('all')
  const bets = data?.bets ?? []

  const filtered = useMemo(() => {
    if (filter === 'pending') return bets.filter((b) => b.status === 'PENDING')
    if (filter === 'settled') return bets.filter((b) => b.status !== 'PENDING')
    return bets
  }, [bets, filter])

  const totals = useMemo(() => {
    let staked = 0
    let returned = 0
    let won = 0
    let lost = 0
    for (const b of bets) {
      staked += b.wager
      returned += b.payout
      if (b.status === 'WON') won++
      else if (b.status === 'LOST') lost++
    }
    return {
      staked,
      returned,
      net: returned - staked,
      won,
      lost,
      settled: won + lost,
    }
  }, [bets])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
            Your bets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every guess you've placed. Newest first.
          </p>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="settled">Settled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          icon={<Receipt className="h-4 w-4" />}
          label="Total wagered"
          value={`${totals.staked.toLocaleString()} cr`}
          sub={`${bets.length} bet${bets.length === 1 ? '' : 's'}`}
        />
        <SummaryStat
          icon={
            totals.net >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )
          }
          label="Net P/L"
          value={`${totals.net >= 0 ? '+' : ''}${totals.net.toLocaleString()} cr`}
          tone={totals.net > 0 ? 'positive' : totals.net < 0 ? 'negative' : 'neutral'}
        />
        <SummaryStat
          icon={<Sparkles className="h-4 w-4" />}
          label="Hit rate"
          value={
            totals.settled === 0
              ? '—'
              : `${Math.round((totals.won / totals.settled) * 100)}%`
          }
          sub={
            totals.settled === 0
              ? 'no settled bets yet'
              : `${totals.won} won · ${totals.lost} lost`
          }
        />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-no">
            <ShieldAlert className="h-4 w-4" />
            Could not load bets: {extractApiError(error)}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {filter === 'all'
              ? "You haven't placed any bets yet. Go pick a time."
              : `No ${filter} bets.`}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((bet) => (
                <BetRow key={bet.id} bet={bet} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryStat({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'grid h-9 w-9 place-items-center rounded-md',
            tone === 'positive' && 'bg-yes/10 text-yes',
            tone === 'negative' && 'bg-no/10 text-no',
            tone === 'neutral' && 'bg-secondary text-muted-foreground',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div
            className={cn(
              'font-mono text-lg font-semibold tabular-nums',
              tone === 'positive' && 'text-yes',
              tone === 'negative' && 'text-no',
            )}
          >
            {value}
          </div>
          {sub && (
            <div className="text-[11px] text-muted-foreground">{sub}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BetRow({ bet }: { bet: Bet }) {
  const cancel = useCancelBet()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCancellable =
    bet.status === 'PENDING' &&
    bet.marketDay?.status === 'OPEN' &&
    !bet.marketDay.locked

  async function doCancel() {
    setError(null)
    try {
      await cancel.mutateAsync(bet.id)
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not cancel')
      setConfirming(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Badge
          variant="outline"
          className={cn('shrink-0 rounded-md font-mono', STATUS_COLOR[bet.status])}
        >
          {STATUS_LABEL[bet.status]}
        </Badge>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{describeBet(bet)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDay(bet.marketDay?.date)}
            </span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {bet.wager} cr · {bet.multiplier}× ·{' '}
            {bet.status === 'PENDING'
              ? `to win ${(bet.wager * bet.multiplier).toLocaleString()} cr`
              : bet.status === 'WON'
                ? `won +${(bet.payout - bet.wager).toLocaleString()} cr`
                : bet.status === 'LOST'
                  ? `lost ${bet.wager.toLocaleString()} cr`
                  : bet.status === 'REFUNDED'
                    ? `refunded ${bet.payout.toLocaleString()} cr`
                    : `cancelled · returned ${bet.payout.toLocaleString()} cr`}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {error && <span className="text-[11px] text-no">{error}</span>}
        {isCancellable &&
          (confirming ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={cancel.isPending}
              >
                Keep
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-no/40 text-no hover:bg-no/10"
                onClick={doCancel}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Confirm
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setConfirming(true)}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Cancel
            </Button>
          ))}
      </div>
    </li>
  )
}
