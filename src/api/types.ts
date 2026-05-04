export type Role = 'USER' | 'ADMIN'

export interface PublicUser {
  id: string
  username: string
  name: string
  email: string | null
  role: Role
  credits: number
  bankruptcies: number
  createdAt: string
}

export interface AuthResponse {
  user: PublicUser
  token: string
  expiresAt: string | null
}

export type Granularity = 'HALF_HOUR' | 'QUARTER_HOUR' | 'FIVE_MIN' | 'EXACT'

export type BetStatus =
  | 'PENDING'
  | 'WON'
  | 'LOST'
  | 'REFUNDED'
  | 'CANCELLED'

export type BustReason = 'BEFORE_NINE' | 'AFTER_TENTHIRTY' | 'WFH_SICK'

export type MarketStatus = 'OPEN' | 'LOCKED' | 'RESOLVED' | 'REFUNDED'

export interface MarketDay {
  id: string
  date: string
  status: MarketStatus
  arrivedAtMinute: number | null
  bustReason: BustReason | null
  resolvedAt: string | null
  resolvedById: string | null
  createdAt: string
  updatedAt: string
  /** Computed: true once `now >= lockedAt` or status is RESOLVED/REFUNDED. */
  locked?: boolean
  /** Computed: ISO timestamp when this market locks for new bets. */
  lockedAt?: string
}

export interface MarketBucket {
  id: string
  label: string
  startMinutes: number
  endMinutes: number
  guesses: number
}

export interface MarketView {
  market: MarketDay
  granularity: Granularity
  buckets: MarketBucket[]
  totalGuesses: number
}

export interface WeekMarketsResponse {
  markets: MarketView[]
}

export interface Bet {
  id: string
  userId: string
  marketDayId: string
  granularity: Granularity
  bucketStartMinute: number | null
  bucketEndMinute: number | null
  exactMinute: number | null
  wager: number
  multiplier: number
  status: BetStatus
  payout: number
  settledAt: string | null
  createdAt: string
  updatedAt: string
  marketDay?: MarketDay
}

export interface BetWithUser extends Bet {
  user: { id: string; username: string }
}

export interface LeaderboardRow {
  rank: number
  userId: string
  username: string
  name: string
  credits: number
  bankruptcies: number
  bets: number
  won: number
  lost: number
  pending: number
  accuracy: number | null
  biggestWin: number
  biggestWinAt: string | null
}

export interface LeaderboardResponse {
  range: 'today' | 'week' | 'all'
  rows: LeaderboardRow[]
}

export interface InviteUsage {
  id: string
  username: string
  createdAt: string
}

export interface InviteToken {
  id: string
  token: string
  createdById: string | null
  /** Role granted to anyone who signs up with this invite. */
  grantsRole: Role
  /** Set once an admin revokes the invite (soft delete). */
  revokedAt: string | null
  expiresAt: string | null
  note: string | null
  createdAt: string
  /** Null only for the bootstrap invite minted before any user existed. */
  createdBy: { id: string; username: string } | null
  /** Users who have signed up using this invite, oldest first. */
  usages: InviteUsage[]
  /** Convenience count from the API (matches `usages.length`). */
  usageCount: number
}

export interface ResolveMarketResponse {
  market: MarketDay
  settled: { won: number; lost: number; payoutTotal: number }
}

export interface PlaceBetInput {
  marketDayId: string
  granularity: Granularity
  bucketStartMinute?: number
  bucketEndMinute?: number
  exactMinute?: number
  wager: number
}

export interface RefundMarketResponse {
  market: MarketDay
  refundedCount: number
  refundTotal: number
}

export type RecentArrival =
  | { day: string; date: string; kind: 'wfh' }
  | { day: string; date: string; kind: 'pending' }
  | { day: string; date: string; kind: 'refunded' }
  | { day: string; date: string; kind: 'busted'; bustReason: BustReason }
  | { day: string; date: string; kind: 'arrived'; minute: number }

export interface TaylorStats {
  traderCount: number
  avgArrivalMinute: number | null
  arrivalSampleSize: number
  recentArrivals: RecentArrival[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    errors?: unknown
  }
}
