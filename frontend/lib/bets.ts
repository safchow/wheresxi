import type { Bet } from '@/api/types'
import { formatMinute12 } from '@/lib/format'

export function describeBet(bet: Bet): string {
  if (bet.granularity === 'EXACT') {
    return `${formatMinute12(bet.exactMinute ?? 0)} AM exact`
  }
  if (bet.bucketStartMinute != null && bet.bucketEndMinute != null) {
    return `${formatMinute12(bet.bucketStartMinute)} – ${formatMinute12(
      bet.bucketEndMinute,
    )}`
  }
  return '—'
}
