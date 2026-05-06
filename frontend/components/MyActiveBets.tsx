import { useMemo, useState } from 'react'
import { Loader2, Receipt, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCancelBet, useMyBets } from '@/api/queries'
import { extractApiError } from '@/lib/errors'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { Bet } from '@/api/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatTime(min: number): string {
  const h24 = Math.floor(min / 60)
  const mm = min % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm.toString().padStart(2, '0')}`
}

function formatDay(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${DAY_NAMES[d.getUTCDay()]} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function describeBet(bet: Bet): string {
  if (bet.granularity === 'EXACT') {
    return `${formatTime(bet.exactMinute ?? 0)} AM exact`
  }
  if (bet.bucketStartMinute != null && bet.bucketEndMinute != null) {
    return `${formatTime(bet.bucketStartMinute)} – ${formatTime(bet.bucketEndMinute)}`
  }
  return '—'
}

export function MyActiveBets() {
  const { isLoggedIn } = useAuth()
  const { data, isLoading } = useMyBets()
  const pending = useMemo(
    () =>
      (data?.bets ?? []).filter(
        (b) => b.status === 'PENDING' && b.marketDay?.status === 'OPEN',
      ),
    [data],
  )

  if (!isLoggedIn) return null
  if (!isLoading && pending.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Your active bets
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          Cancel any time before the market closes.
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="grid place-items-center p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((bet) => (
              <ActiveBetRow key={bet.id} bet={bet} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ActiveBetRow({ bet }: { bet: Bet }) {
  const cancel = useCancelBet()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setError(null)
    try {
      await cancel.mutateAsync(bet.id)
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not cancel')
      setConfirming(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Badge variant="outline" className="shrink-0 rounded-md font-mono">
          {formatDay(bet.marketDay?.date)}
        </Badge>
        <div className="min-w-0">
          <div className="truncate font-medium">{describeBet(bet)}</div>
          <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {bet.wager} cr · {bet.multiplier}× payout · win{' '}
            {(bet.wager * bet.multiplier).toLocaleString()} cr
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {error && (
          <span className="text-[11px] text-no">{error}</span>
        )}
        {confirming ? (
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
              className={cn(
                'gap-1.5 border-no/40 text-no hover:bg-no/10',
                cancel.isPending && 'opacity-70',
              )}
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Confirm cancel
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
        )}
      </div>
    </li>
  )
}
