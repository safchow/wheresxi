import { useState } from 'react'
import { Crown, Loader2, Medal, Skull, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useLeaderboard } from '@/api/queries'
import type { LeaderboardRow } from '@/api/types'

type Range = 'today' | 'week' | 'all'

function fmtCr(n: number) {
  return `${n.toLocaleString()} cr`
}

function avatarGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  const hue = h % 360
  return `conic-gradient(from 180deg at 50% 50%, hsl(${hue} 70% 55%), hsl(${(hue + 60) % 360} 70% 55%), hsl(${(hue + 120) % 360} 70% 55%), hsl(${hue} 70% 55%))`
}

export function LeaderboardPage() {
  const { user: me } = useAuth()
  const [range, setRange] = useState<Range>('week')
  const { data, isLoading, isError, error, isFetching } =
    useLeaderboard(range)
  const rows = data?.rows ?? []
  const podium = rows.slice(0, 3)
  const tableRows = rows.slice(3)

  const meRow = me
    ? rows.find((r) => r.userId === me.id)
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:whitespace-nowrap">
            The people who have correctly guessed Taylor's comings (and goings)
            more than you.
          </p>
        </div>
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as Range)}
          className="sm:ml-auto sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="all">All-time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading leaderboard…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-no">
            Could not load leaderboard: {extractApiError(error)}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No players on the board yet. Be the first.
          </CardContent>
        </Card>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {podium.map((e) => (
                <PodiumCard key={e.userId} entry={e} />
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="hidden grid-cols-[64px_1fr_120px_120px_100px_120px] gap-3 px-5 py-3 text-[11px] uppercase tracking-wide text-muted-foreground md:grid">
                <div>Rank</div>
                <div>Player</div>
                <div className="text-right">Credits</div>
                <div className="text-right">Bankruptcies</div>
                <div className="text-right">Accuracy</div>
                <div className="text-right">Bets</div>
              </div>
              <Separator className="hidden md:block" />
              <ul className="divide-y divide-border">
                {tableRows.map((entry) => (
                  <RowItem
                    key={entry.userId}
                    entry={entry}
                    emphasized={!!me && entry.userId === me.id}
                  />
                ))}
              </ul>
              {isFetching && (
                <div className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
                  Refreshing…
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {me && !meRow && (
        <Card className="border-primary/30 bg-primary/[0.04]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              You are not on the board yet
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Place a guess on the home page to start climbing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ─── sub-components ───────────────────────────────────────────────────── */

function PodiumCard({ entry }: { entry: LeaderboardRow }) {
  const rankStyle =
    entry.rank === 1
      ? {
          ring: 'ring-amber-300/60',
          bg: 'from-amber-200/30 via-amber-100/10',
          chip: 'bg-amber-300/20 text-amber-500',
          label: '1st',
          icon: <Crown className="h-4 w-4" />,
        }
      : entry.rank === 2
        ? {
            ring: 'ring-zinc-300/60',
            bg: 'from-zinc-200/30 via-zinc-100/10',
            chip: 'bg-zinc-300/20 text-zinc-500 dark:text-zinc-300',
            label: '2nd',
            icon: <Medal className="h-4 w-4" />,
          }
        : {
            ring: 'ring-orange-400/50',
            bg: 'from-orange-300/30 via-orange-200/10',
            chip: 'bg-orange-400/20 text-orange-500',
            label: '3rd',
            icon: <Medal className="h-4 w-4" />,
          }

  return (
    <Card className={cn('overflow-hidden ring-1', rankStyle.ring)}>
      <CardContent
        className={cn(
          'relative bg-gradient-to-b to-transparent p-5',
          rankStyle.bg,
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 shrink-0 rounded-full ring-2 ring-background"
            style={{ background: avatarGradient(entry.username) }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                  rankStyle.chip,
                )}
              >
                {rankStyle.icon}
                {rankStyle.label}
              </div>
            </div>
            <div className="mt-1 truncate font-semibold">@{entry.username}</div>
            <div className="truncate text-xs text-muted-foreground">
              {entry.name}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Credits" value={fmtCr(entry.credits)} />
          <MiniStat
            label="Accuracy"
            value={entry.accuracy === null ? '—' : `${entry.accuracy}%`}
          />
          <MiniStat label="Bankruptcies" value={`${entry.bankruptcies}`} />
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          {entry.biggestWin > 0 ? (
            <>
              Biggest win:{' '}
              <span className="font-mono">{fmtCr(entry.biggestWin)}</span>
            </>
          ) : (
            <>No wins yet.</>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function RowItem({
  entry,
  emphasized = false,
}: {
  entry: LeaderboardRow
  emphasized?: boolean
}) {
  return (
    <li
      className={cn(
        'grid grid-cols-[56px_1fr_auto] items-center gap-3 px-5 py-3 md:grid-cols-[64px_1fr_120px_120px_100px_120px]',
        emphasized && 'bg-primary/[0.04]',
      )}
    >
      <div className="font-mono text-sm tabular-nums text-muted-foreground">
        #{entry.rank}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="h-8 w-8 shrink-0 rounded-full ring-1 ring-border"
          style={{ background: avatarGradient(entry.username) }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              @{entry.username}
            </span>
            {emphasized && (
              <Badge variant="outline" className="text-[10px]">
                you
              </Badge>
            )}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {entry.name}
          </div>
        </div>
      </div>
      <div className="hidden text-right font-mono text-sm font-semibold tabular-nums md:block">
        {fmtCr(entry.credits)}
      </div>
      <div className="hidden text-right md:block">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-mono text-sm tabular-nums',
            entry.bankruptcies >= 3 && 'text-no',
          )}
        >
          {entry.bankruptcies > 0 && <Skull className="h-3.5 w-3.5" />}
          {entry.bankruptcies}
        </span>
      </div>
      <div className="hidden text-right font-mono text-sm tabular-nums md:block">
        {entry.accuracy === null ? '—' : `${entry.accuracy}%`}
      </div>
      <div className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:block">
        {entry.bets}
      </div>
      <div className="col-start-2 md:hidden">
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono text-foreground">
            {fmtCr(entry.credits)}
          </span>
          <span>{entry.accuracy === null ? '—' : `${entry.accuracy}% acc`}</span>
          <span>
            {entry.bankruptcies} bankrupt
            {entry.bankruptcies === 1 ? 'cy' : 'cies'}
          </span>
        </div>
      </div>
    </li>
  )
}
