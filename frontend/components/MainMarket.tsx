import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'
import {
  formatCompactNumber,
  formatMinute12,
  formatShortMonthDay,
  formatShortWeekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useAllWeekMarkets,
  useExactMinuteGuesses,
  usePlaceBet,
} from '@/api/queries'
import type {
  Granularity,
  MarketBucket,
  MarketView,
} from '@/api/types'

type ExactSelection = { kind: 'exact'; hour: number; minute: number }
type BucketSelection = { kind: 'bucket'; bucketId: string }
type Selection = ExactSelection | BucketSelection | null

const GRANULARITY_ORDER: Granularity[] = [
  'HALF_HOUR',
  'QUARTER_HOUR',
  'FIVE_MIN',
  'EXACT',
]

const GRANULARITY_LABELS: Record<Granularity, string> = {
  HALF_HOUR: 'Half hour',
  QUARTER_HOUR: '15 minutes',
  FIVE_MIN: '5 minutes',
  EXACT: 'Exact minute',
}

const MULTIPLIERS: Record<Granularity, number> = {
  HALF_HOUR: 2,
  QUARTER_HOUR: 4,
  FIVE_MIN: 12,
  EXACT: 60,
}

const EXACT_HOURS = [9, 10]

function minutesForHour(h: number) {
  const max = h === 10 ? 30 : 59
  return Array.from({ length: max + 1 }, (_, i) => i)
}

export function MainMarket() {
  const [granularity, setGranularity] = useState<Granularity>('HALF_HOUR')
  // All four granularities are fetched on mount in parallel; switching tabs
  // becomes a cache read. Only the active granularity polls in the
  // background to keep network noise reasonable.
  const { activeQuery: weekQuery } = useAllWeekMarkets(granularity)
  const markets = weekQuery.data?.markets ?? []
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  // Default-select the soonest non-resolved day; otherwise first.
  useEffect(() => {
    if (markets.length === 0) return
    setSelectedDayId((prev) => {
      if (prev && markets.some((m) => m.market.id === prev)) return prev
      const live = markets.find((m) => m.market.status === 'OPEN')
      return live?.market.id ?? markets[0].market.id
    })
  }, [markets])

  const selectedView = useMemo<MarketView | null>(
    () =>
      markets.find((m) => m.market.id === selectedDayId) ?? markets[0] ?? null,
    [markets, selectedDayId],
  )

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-5 md:p-7 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 rounded-md">
              <CalendarDays className="h-3 w-3" />
              Tue · Wed · Thu only
            </Badge>
            <Badge variant="outline" className="gap-1 rounded-md">
              <Clock className="h-3 w-3" />
              Closes 12:00 AM ET
            </Badge>
            <Badge variant="outline" className="gap-1 rounded-md">
              <Users className="h-3 w-3" />
              {formatCompactNumber(selectedView?.totalGuesses ?? 0)} guesses
            </Badge>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              {selectedView?.market.status === 'RESOLVED' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-no" />
                  RESOLVED
                </>
              ) : selectedView?.market.status === 'REFUNDED' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  REFUNDED
                </>
              ) : selectedView?.market.locked ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  LOCKED
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-yes animate-pulse-soft" />
                  LIVE
                </>
              )}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
            What time will Taylor arrive at the office today?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Resolves based on when Taylor walks into the office. All three days
            of this week are open — bet whenever you want.
          </p>

          {/* Day + granularity tabs live OUTSIDE the `isLoading` conditional
              so they never disappear when switching tabs (which triggers a
              refetch for that granularity's bucket grid). */}
          {weekQuery.isLoading ? (
            <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-border p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : markets.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No markets this week. Check back soon.
            </div>
          ) : (
            <>
              <div className="mt-5">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  This week
                </div>
                <Tabs
                  value={selectedView?.market.id ?? ''}
                  onValueChange={setSelectedDayId}
                >
                  <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                    {markets.map(({ market }) => (
                      <TabsTrigger
                        key={market.id}
                        value={market.id}
                        className="flex flex-col gap-0.5 py-2 h-auto"
                      >
                        <span className="text-sm font-medium">
                          {formatShortWeekday(market.date)}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {formatShortMonthDay(market.date)}
                        </span>
                        {(market.status !== 'OPEN' || market.locked) && (
                          <span
                            className={cn(
                              'mt-0.5 rounded px-1 text-[9px] uppercase tracking-wide',
                              market.status === 'RESOLVED' &&
                                'bg-no/10 text-no',
                              market.status === 'REFUNDED' &&
                                'bg-amber-400/15 text-amber-500',
                              market.status === 'OPEN' &&
                                market.locked &&
                                'bg-secondary text-muted-foreground',
                            )}
                          >
                            {market.status === 'OPEN' && market.locked
                              ? 'LOCKED'
                              : market.status}
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pick your granularity
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Narrower guess = bigger payout
                  </div>
                </div>
                <Tabs
                  value={granularity}
                  onValueChange={(v) => setGranularity(v as Granularity)}
                >
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1">
                    {GRANULARITY_ORDER.map((g) => (
                      <TabsTrigger
                        key={g}
                        value={g}
                        className="flex flex-col gap-0.5 py-2 h-auto"
                      >
                        <span className="text-sm font-medium">
                          {GRANULARITY_LABELS[g]}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {MULTIPLIERS[g]}× payout
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {selectedView && (
                <div
                  className={cn(
                    'transition-opacity',
                    weekQuery.isPlaceholderData && 'opacity-60',
                  )}
                >
                  <DaySelector
                    view={selectedView}
                    granularity={granularity}
                    key={`${selectedView.market.id}-${granularity}`}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {selectedView ? (
          <DayWagerSlot
            view={selectedView}
            granularity={granularity}
            key={`${selectedView.market.id}-${granularity}`}
          />
        ) : (
          <aside className="w-full shrink-0 self-start rounded-lg border border-border bg-secondary/30 p-4 lg:w-80" />
        )}
      </div>
    </Card>
  )
}

/**
 * Renders the bucket grid (or exact-minute picker) for a specific market day
 * and exposes its current selection upward via a window ref. Selection lives
 * in this component so switching days resets it cleanly.
 */
function DaySelector({
  view,
  granularity,
}: {
  view: MarketView
  granularity: Granularity
}) {
  const buckets = view.buckets
  const [selection, setSelection] = useDaySelection(view.market.id, buckets, granularity)

  if (granularity === 'EXACT') {
    return (
      <ExactMinutePicker
        marketDayId={view.market.id}
        hour={selection?.kind === 'exact' ? selection.hour : 10}
        minute={selection?.kind === 'exact' ? selection.minute : 15}
        onChange={(hour, minute) =>
          setSelection({ kind: 'exact', hour, minute })
        }
      />
    )
  }
  return (
    <BucketGrid
      buckets={buckets}
      granularity={granularity}
      selectedId={selection?.kind === 'bucket' ? selection.bucketId : null}
      onSelect={(id) => setSelection({ kind: 'bucket', bucketId: id })}
    />
  )
}

/** Wager panel for a specific market view. */
function DayWagerSlot({
  view,
  granularity,
}: {
  view: MarketView
  granularity: Granularity
}) {
  const [selection] = useDaySelection(view.market.id, view.buckets, granularity)
  const selectedBucket =
    selection?.kind === 'bucket'
      ? view.buckets.find((b) => b.id === selection.bucketId) ?? null
      : null
  const exactMinuteTotal =
    selection?.kind === 'exact' ? selection.hour * 60 + selection.minute : 0
  const isLocked =
    view.market.status === 'RESOLVED' ||
    view.market.status === 'REFUNDED' ||
    Boolean(view.market.locked)

  return (
    <WagerPanel
      market={view.market}
      granularity={granularity}
      selection={selection}
      selectedBucket={selectedBucket}
      exactMinuteTotal={exactMinuteTotal}
      marketLocked={isLocked}
    />
  )
}

/**
 * Module-level cache of "what bucket did the user select for this day at this
 * granularity". Lets DaySelector and WagerPanel share state without lifting
 * up to the parent (which would re-render the whole card on every click).
 */
const selectionStore = new Map<string, Selection>()
const selectionListeners = new Map<string, Set<() => void>>()

function notify(key: string) {
  selectionListeners.get(key)?.forEach((cb) => cb())
}

function subscribe(key: string, cb: () => void) {
  let set = selectionListeners.get(key)
  if (!set) {
    set = new Set()
    selectionListeners.set(key, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
  }
}

function useDaySelection(
  marketDayId: string,
  buckets: MarketBucket[],
  granularity: Granularity,
): [Selection, (s: Selection) => void] {
  const key = `${marketDayId}::${granularity}`
  const [, force] = useState(0)

  useEffect(() => {
    return subscribe(key, () => force((n) => n + 1))
  }, [key])

  // Compute the effective selection synchronously during render. If the
  // store has nothing valid for this granularity yet, fall back to the
  // simplest default (first bucket / 9:00 exact) and persist it
  // immediately — so the wager panel never shows "—" between a granularity
  // change and a deferred useEffect.
  let selection = selectionStore.get(key) ?? null

  if (granularity === 'EXACT') {
    if (!selection || selection.kind !== 'exact') {
      selection = { kind: 'exact', hour: 9, minute: 0 }
      selectionStore.set(key, selection)
    }
  } else if (buckets.length > 0) {
    const bucketSelection =
      selection?.kind === 'bucket' ? selection : null
    const valid =
      bucketSelection !== null &&
      buckets.some((b) => b.id === bucketSelection.bucketId)
    if (!valid) {
      selection = { kind: 'bucket', bucketId: buckets[0].id }
      selectionStore.set(key, selection)
    }
  }

  const setter = (next: Selection) => {
    selectionStore.set(key, next)
    notify(key)
  }
  return [selection, setter]
}

/* ─── grid ──────────────────────────────────────────────────────────────── */

function BucketGrid({
  buckets,
  granularity,
  selectedId,
  onSelect,
}: {
  buckets: MarketBucket[]
  granularity: Granularity
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const maxGuesses = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.guesses)),
    [buckets],
  )
  const cols =
    granularity === 'FIVE_MIN'
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
      : granularity === 'QUARTER_HOUR'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3'
  const maxH =
    granularity === 'FIVE_MIN' ? 'max-h-[420px] overflow-y-auto pr-1' : ''
  return (
    <div className={cn('mt-4', maxH)}>
      <div className={cn('grid gap-2', cols)}>
        {buckets.map((b) => (
          <BucketCell
            key={b.id}
            bucket={b}
            selected={b.id === selectedId}
            popularity={b.guesses / maxGuesses}
            onClick={() => onSelect(b.id)}
          />
        ))}
      </div>
    </div>
  )
}

function BucketCell({
  bucket,
  selected,
  popularity,
  onClick,
}: {
  bucket: MarketBucket
  selected: boolean
  popularity: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all',
        selected
          ? 'border-primary/60 bg-primary/[0.05] shadow-sm'
          : 'border-border hover:border-foreground/20 hover:bg-accent',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-primary/15"
        style={{ width: `${Math.round(popularity * 100)}%` }}
      />
      <div className="truncate text-sm font-medium tabular-nums">
        {bucket.label}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
        {bucket.guesses.toLocaleString()} guesses
      </div>
    </button>
  )
}

/* ─── exact minute ──────────────────────────────────────────────────────── */

function ExactMinutePicker({
  marketDayId,
  hour,
  minute,
  onChange,
}: {
  marketDayId: string
  hour: number
  minute: number
  onChange: (hour: number, minute: number) => void
}) {
  const minuteOptions = minutesForHour(hour)
  const totalMinutes = hour * 60 + minute
  const { data } = useExactMinuteGuesses(marketDayId, totalMinutes)
  const guesses = data?.guesses ?? 0

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-primary/60 bg-primary/[0.05] p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Exact arrival time
        </div>
        <div className="mt-2 flex items-center gap-2">
          <TimeSelect
            value={hour}
            onChange={(h) => {
              const max = h === 10 ? 30 : 59
              onChange(h, Math.min(minute, max))
            }}
            options={EXACT_HOURS}
            label="hours"
            format={(n) => n.toString()}
          />
          <span className="font-mono text-2xl font-semibold">:</span>
          <TimeSelect
            value={minute}
            onChange={(m) => onChange(hour, m)}
            options={minuteOptions}
            label="minutes"
            format={(n) => n.toString().padStart(2, '0')}
          />
          <span className="ml-2 font-mono text-sm text-muted-foreground">
            AM
          </span>
        </div>
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">
          {guesses.toLocaleString()} guesses at this minute
        </div>
      </div>
    </div>
  )
}

function TimeSelect({
  value,
  onChange,
  options,
  label,
  format,
}: {
  value: number
  onChange: (n: number) => void
  options: number[]
  label: string
  format: (n: number) => string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-11 appearance-none rounded-md border border-input bg-background pl-3 pr-8 font-mono text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        ▾
      </span>
    </div>
  )
}

/* ─── wager panel ───────────────────────────────────────────────────────── */

function WagerPanel({
  market,
  granularity,
  selection,
  selectedBucket,
  exactMinuteTotal,
  marketLocked,
}: {
  market: { id: string; date: string }
  granularity: Granularity
  selection: Selection
  selectedBucket: MarketBucket | null
  exactMinuteTotal: number
  marketLocked: boolean
}) {
  const { user } = useAuth()
  const balance = user?.credits ?? 0
  const [wager, setWager] = useState<number>(25)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const placeBetMutation = usePlaceBet()

  const multiplier = MULTIPLIERS[granularity]
  const potential = wager * multiplier
  const profit = potential - wager

  useEffect(() => {
    setSuccess(null)
    setError(null)
  }, [granularity, selection, wager, market.id])

  const guessLabel =
    granularity === 'EXACT'
      ? `${formatMinute12(exactMinuteTotal)} AM`
      : selectedBucket?.label ?? '—'

  const guessCount =
    granularity === 'EXACT' ? null : selectedBucket?.guesses ?? 0

  const overBalance = wager > balance
  const noSelection = selection === null
  const disabled =
    placeBetMutation.isPending ||
    overBalance ||
    noSelection ||
    marketLocked ||
    wager < 1

  async function submit() {
    setError(null)
    setSuccess(null)
    if (!selection) return
    try {
      if (selection.kind === 'exact') {
        const minute = selection.hour * 60 + selection.minute
        await placeBetMutation.mutateAsync({
          marketDayId: market.id,
          granularity: 'EXACT',
          exactMinute: minute,
          wager,
        })
      } else if (selectedBucket) {
        await placeBetMutation.mutateAsync({
          marketDayId: market.id,
          granularity,
          bucketStartMinute: selectedBucket.startMinutes,
          bucketEndMinute: selectedBucket.endMinutes,
          wager,
        })
      }
      setSuccess(
        `Locked in ${wager} cr on ${guessLabel} for ${formatShortWeekday(market.date)} ${formatShortMonthDay(market.date)}.`,
      )
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not place guess')
    }
  }

  return (
    <aside className="w-full shrink-0 self-start rounded-lg border border-border bg-secondary/30 p-4 lg:w-80">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Your guess for {formatShortWeekday(market.date)}{' '}
        {formatShortMonthDay(market.date)}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {guessLabel}
      </div>
      {guessCount !== null && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          {guessCount.toLocaleString()} other people guessed this
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {GRANULARITY_LABELS[granularity]} payout
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums">
            {multiplier}×
          </div>
        </div>
        <Sparkles className="h-5 w-5 text-yes" />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Wager
          </label>
          <span className="text-[11px] text-muted-foreground">
            balance{' '}
            <span className="font-mono tabular-nums text-foreground">
              {balance.toLocaleString()} cr
            </span>
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9"
            onClick={() => setWager((s) => Math.max(1, s - 5))}
          >
            −
          </Button>
          <div className="relative flex-1">
            <Input
              type="number"
              value={wager}
              min={1}
              onChange={(e) =>
                setWager(Math.max(1, Number(e.target.value) || 1))
              }
              className="h-9 pr-9 text-center font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
              cr
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9"
            onClick={() => setWager((s) => s + 5)}
          >
            +
          </Button>
        </div>
        <div className="mt-2 flex gap-1">
          {[10, 25, 100, 500].map((n) => (
            <Button
              key={n}
              variant="ghost"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => setWager(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 rounded-md border border-dashed border-border bg-background/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">If correct, you win</span>
          <span className="font-mono tabular-nums text-yes">
            {potential.toLocaleString()} cr
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Profit</span>
          <span className="font-mono tabular-nums">
            +{profit.toLocaleString()} cr
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">If wrong</span>
          <span className="font-mono tabular-nums text-no">
            −{wager.toLocaleString()} cr
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-no/40 bg-no/10 px-3 py-2 text-xs text-no">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-md border border-yes/40 bg-yes/10 px-3 py-2 text-xs text-yes">
          {success}
        </div>
      )}

      <Button className="mt-4 w-full" onClick={submit} disabled={disabled}>
        {placeBetMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Placing…
          </>
        ) : marketLocked ? (
          'Market closed'
        ) : overBalance ? (
          'Not enough credits'
        ) : (
          `Place guess · ${wager} cr`
        )}
      </Button>
      <div className="mt-2 text-center text-[11px] text-muted-foreground">
        Credits are not legal tender in any jurisdiction.
      </div>
    </aside>
  )
}
