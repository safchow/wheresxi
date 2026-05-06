import { Loader2, MapPin, Timer, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTaylorStats } from '@/api/queries'
import {
  formatCompactNumber,
  formatMinute24,
  formatMinuteWithMeridiem,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BustReason, RecentArrival } from '@/api/types'

const BUST_LABEL: Record<BustReason, string> = {
  BEFORE_NINE: 'Before 9 AM',
  AFTER_TENTHIRTY: 'After 10:30',
  WFH_SICK: 'WFH/sick',
}

function describeArrival(a: RecentArrival): string {
  switch (a.kind) {
    case 'wfh':
      return 'WFH'
    case 'pending':
      return '—'
    case 'refunded':
      return 'Refunded'
    case 'busted':
      return BUST_LABEL[a.bustReason]
    case 'arrived':
      return formatMinute24(a.minute)
  }
}

export function TaylorDossier() {
  const { data, isLoading } = useTaylorStats()

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-no/5" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-no/30 text-2xl font-semibold text-primary-foreground ring-4 ring-background">
              <span className="text-foreground">T</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">Taylor</h3>
                <Badge variant="secondary" className="rounded-md">
                  Senior at being late
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Last seen: online on Steam at 3am.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 divide-x divide-border">
          <Stat
            icon={<Timer className="h-4 w-4" />}
            label="Avg arrival"
            value={
              isLoading
                ? '—'
                : data?.avgArrivalMinute == null
                  ? 'no data'
                  : formatMinuteWithMeridiem(data.avgArrivalMinute)
            }
            sub={
              data && data.arrivalSampleSize > 0
                ? `over ${data.arrivalSampleSize} day${
                    data.arrivalSampleSize === 1 ? '' : 's'
                  }`
                : undefined
            }
          />
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Traders watching"
            value={
              isLoading
                ? '—'
                : formatCompactNumber(data?.traderCount ?? 0, {
                    compactThousandsAt: 10_000,
                    localeBelowThreshold: true,
                  })
            }
          />
        </div>

        <Separator />

        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Recent arrivals
            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {(data?.recentArrivals ?? PLACEHOLDER_DAYS).map((r) => (
              <div
                key={r.date}
                className={cn(
                  'rounded-lg border border-border bg-secondary/40 p-3 text-center',
                  r.kind === 'arrived' && 'border-yes/40 bg-yes/[0.06]',
                  r.kind === 'refunded' && 'border-amber-400/30',
                  r.kind === 'busted' && 'border-no/30',
                )}
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {r.day}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {describeArrival(r)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  )
}

const PLACEHOLDER_DAYS: RecentArrival[] = [
  { day: 'Mon', date: 'placeholder-mon', kind: 'pending' },
  { day: 'Tue', date: 'placeholder-tue', kind: 'pending' },
  { day: 'Wed', date: 'placeholder-wed', kind: 'pending' },
  { day: 'Thu', date: 'placeholder-thu', kind: 'pending' },
  { day: 'Fri', date: 'placeholder-fri', kind: 'pending' },
]
