import { useMemo, useState } from 'react'
import { CheckCircle2, Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import {
  useAdminInvites,
  useAdminMarkets,
  useAdminRefundMarket,
  useAdminResolveMarket,
  useCreateInvite,
  useRevokeInvite,
} from '@/client/queries'
import type { BustReason, MarketDay } from '@/client/types'

const BUST_REASON_LABEL: Record<BustReason, string> = {
  BEFORE_NINE: 'Arrived before 9 AM',
  AFTER_TENTHIRTY: 'Arrived after 10:30 AM',
  WFH_SICK: 'WFH or sick',
}

function todayISODate() {
  const d = new Date()
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10)
}

function formatMinute(min: number) {
  const h24 = Math.floor(min / 60)
  const mm = min % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`
}

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
          Admin
        </h1>
        <Badge variant="outline">ADMIN</Badge>
      </div>

      <ResolveMarketCard />

      <RecentMarketsCard />

      <InvitesCard />
    </div>
  )
}

/* ─── resolve market ──────────────────────────────────────────────────── */

type ResolveMode = 'arrived' | 'bust' | 'refund'

function ResolveMarketCard() {
  const [date, setDate] = useState(todayISODate())
  const [mode, setMode] = useState<ResolveMode>('arrived')
  const [hour, setHour] = useState<number>(10)
  const [minute, setMinute] = useState<number>(15)
  const [reason, setReason] = useState<BustReason>('AFTER_TENTHIRTY')
  const resolveMutation = useAdminResolveMarket()
  const refundMutation = useAdminRefundMarket()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const minuteMax = hour === 10 ? 30 : 59
  const isPending = resolveMutation.isPending || refundMutation.isPending

  async function submit() {
    setError(null)
    setSuccess(null)
    try {
      if (mode === 'refund') {
        const result = await refundMutation.mutateAsync({ date })
        setSuccess(
          `Refunded ${date}. ${result.refundedCount} bets returned, ${result.refundTotal.toLocaleString()} cr paid back.`,
        )
        return
      }
      const result = await resolveMutation.mutateAsync(
        mode === 'arrived'
          ? { date, arrivedAtMinute: hour * 60 + minute }
          : { date, bustReason: reason },
      )
      const settled = result.settled
      setSuccess(
        `Resolved ${date}. ${settled.won} won, ${settled.lost} lost, ${settled.payoutTotal.toLocaleString()} cr paid out.`,
      )
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not settle market')
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Resolve a market</h2>
          <span className="text-xs text-muted-foreground">
            Settles every pending bet for the chosen day.
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Market date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Outcome
            </label>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode('arrived')}
                className={cn(
                  'rounded-md border px-3 py-2 text-left text-sm transition',
                  mode === 'arrived'
                    ? 'border-primary/60 bg-primary/[0.05]'
                    : 'border-border hover:bg-accent',
                )}
              >
                <div className="font-medium">Taylor arrived</div>
                <div className="text-xs text-muted-foreground">
                  pay out matching guesses
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('bust')}
                className={cn(
                  'rounded-md border px-3 py-2 text-left text-sm transition',
                  mode === 'bust'
                    ? 'border-no/60 bg-no/[0.05]'
                    : 'border-border hover:bg-accent',
                )}
              >
                <div className="font-medium">Everyone busts</div>
                <div className="text-xs text-muted-foreground">
                  no payouts, wagers kept
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('refund')}
                className={cn(
                  'rounded-md border px-3 py-2 text-left text-sm transition',
                  mode === 'refund'
                    ? 'border-amber-400/60 bg-amber-400/[0.05]'
                    : 'border-border hover:bg-accent',
                )}
              >
                <div className="font-medium">Refund all</div>
                <div className="text-xs text-muted-foreground">
                  void market, return wagers
                </div>
              </button>
            </div>
          </div>
        </div>

        {mode === 'arrived' ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Arrival time
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={hour}
                onChange={(e) => {
                  const h = Number(e.target.value)
                  setHour(h)
                  if (h === 10 && minute > 30) setMinute(30)
                }}
                className="h-10 rounded-md border border-input bg-background px-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={9}>9</option>
                <option value={10}>10</option>
              </select>
              <span className="font-mono text-base">:</span>
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: minuteMax + 1 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>
                    {m.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="font-mono text-sm text-muted-foreground">
                AM
              </span>
            </div>
          </div>
        ) : mode === 'bust' ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Bust reason
            </label>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {(Object.keys(BUST_REASON_LABEL) as BustReason[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm transition',
                    reason === r
                      ? 'border-no/60 bg-no/[0.05]'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {BUST_REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2 text-xs text-muted-foreground">
            Refund voids the market. Every pending bet is returned to its
            owner. Use this for holidays, weather closures, or anything that
            makes "when did Taylor arrive" unanswerable.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-no/40 bg-no/10 px-3 py-2 text-xs text-no">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-md border border-yes/40 bg-yes/10 px-3 py-2 text-xs text-yes">
            {success}
          </div>
        )}

        <Button onClick={submit} className="mt-4" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === 'refund' ? 'Refunding…' : 'Resolving…'}
            </>
          ) : mode === 'refund' ? (
            'Refund market'
          ) : (
            'Resolve market'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ─── recent markets ──────────────────────────────────────────────────── */

function RecentMarketsCard() {
  const { data, isLoading } = useAdminMarkets()
  const markets = data?.markets ?? []

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-baseline justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold">Recent markets</h2>
          <span className="text-xs text-muted-foreground">last 60</span>
        </div>
        <Separator />
        {isLoading ? (
          <div className="grid place-items-center p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : markets.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No markets recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {markets.map((m) => (
              <MarketRow key={m.id} market={m} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MarketRow({ market }: { market: MarketDay }) {
  const date = new Date(market.date)
  const dateStr = `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

  const outcome = (() => {
    if (market.status === 'REFUNDED') return 'Refunded'
    if (market.status !== 'RESOLVED') return null
    if (market.bustReason) return BUST_REASON_LABEL[market.bustReason]
    if (market.arrivedAtMinute !== null)
      return `Arrived at ${formatMinute(market.arrivedAtMinute)}`
    return null
  })()

  return (
    <li className="grid grid-cols-[120px_1fr_120px] items-center gap-3 px-6 py-3 text-sm">
      <div className="font-mono tabular-nums">{dateStr}</div>
      <div className="text-muted-foreground">{outcome ?? '—'}</div>
      <div className="text-right">
        {market.status === 'RESOLVED' ? (
          <Badge variant="yes" className="rounded-md">
            resolved
          </Badge>
        ) : market.status === 'REFUNDED' ? (
          <Badge variant="outline" className="rounded-md text-amber-500">
            refunded
          </Badge>
        ) : market.status === 'LOCKED' ? (
          <Badge variant="outline" className="rounded-md">
            locked
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-md">
            open
          </Badge>
        )}
      </div>
    </li>
  )
}

/* ─── invites ─────────────────────────────────────────────────────────── */

type InviteStatus = 'active' | 'revoked' | 'expired'

function inviteStatus(inv: {
  revokedAt: string | null
  expiresAt: string | null
}): InviteStatus {
  if (inv.revokedAt) return 'revoked'
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())
    return 'expired'
  return 'active'
}

function InvitesCard() {
  const { user } = useAuth()
  const { data, isLoading } = useAdminInvites()
  const invites = data?.invites ?? []
  const createInviteMutation = useCreateInvite()
  const revokeInviteMutation = useRevokeInvite()
  const [note, setNote] = useState('')
  const [expires, setExpires] = useState<string>('')
  const [grantsRole, setGrantsRole] = useState<'USER' | 'ADMIN'>('USER')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }, [])

  async function create() {
    setError(null)
    try {
      await createInviteMutation.mutateAsync({
        note: note.trim() || null,
        expiresInDays: expires ? Number(expires) : null,
        grantsRole,
      })
      setNote('')
      setExpires('')
      setGrantsRole('USER')
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not create invite')
    }
  }

  async function copyLink(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(
        `${baseUrl}/signup?inviteToken=${token}`,
      )
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* clipboard API unavailable */
    }
  }

  if (!user || user.role !== 'ADMIN') return null

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-baseline justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold">Invites</h2>
          <span className="text-xs text-muted-foreground">
            reusable signup links
          </span>
        </div>

        <div className="px-6 pb-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_110px_120px_auto]">
            <Input
              placeholder="Note (optional, e.g. for Marcus)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <select
              value={grantsRole}
              onChange={(e) =>
                setGrantsRole(e.target.value === 'ADMIN' ? 'ADMIN' : 'USER')
              }
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Grants role"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Input
              type="number"
              placeholder="Expires (days)"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              min={1}
            />
            <Button
              onClick={create}
              disabled={createInviteMutation.isPending}
            >
              {createInviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create
            </Button>
          </div>
          {error && (
            <div className="mt-2 rounded-md border border-no/40 bg-no/10 px-3 py-2 text-xs text-no">
              {error}
            </div>
          )}
        </div>

        <Separator />

        {isLoading ? (
          <div className="grid place-items-center p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No invites yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((inv) => {
              const status = inviteStatus(inv)
              const usesLabel = `${inv.usageCount} ${inv.usageCount === 1 ? 'use' : 'uses'}`
              const claimerNames = inv.usages.map((u) => `@${u.username}`)
              return (
                <li
                  key={inv.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-3 px-6 py-3 sm:grid-cols-[1fr_140px_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="truncate rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                        {inv.token}
                      </code>
                      <InviteStatusBadge status={status} />
                      {inv.grantsRole === 'ADMIN' && (
                        <Badge
                          variant="outline"
                          className="rounded-md border-no/50 text-no"
                        >
                          grants ADMIN
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {usesLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {inv.note ? <>{inv.note} · </> : null}
                      created by{' '}
                      {inv.createdBy ? (
                        <>@{inv.createdBy.username}</>
                      ) : (
                        <span className="italic">bootstrap</span>
                      )}
                      {claimerNames.length > 0 && (
                        <> · used by {claimerNames.join(', ')}</>
                      )}
                    </div>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    {inv.expiresAt
                      ? `expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                      : 'no expiry'}
                  </div>
                  <div className="flex items-center gap-1">
                    {status !== 'revoked' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(inv.token, inv.id)}
                      >
                        {copiedId === inv.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    {status !== 'revoked' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInviteMutation.mutate(inv.id)}
                        aria-label="Revoke invite"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-no" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (status === 'active') {
    return (
      <Badge variant="yes" className="rounded-md">
        active
      </Badge>
    )
  }
  if (status === 'revoked') {
    return (
      <Badge variant="secondary" className="rounded-md">
        revoked
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-md">
      expired
    </Badge>
  )
}
