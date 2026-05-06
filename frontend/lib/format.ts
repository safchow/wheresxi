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

function normalizeMinute(minute: number): number {
  return ((minute % (24 * 60)) + 24 * 60) % (24 * 60)
}

export function formatMinute12(minute: number): string {
  const m = normalizeMinute(minute)
  const h24 = Math.floor(m / 60)
  const mm = m % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm.toString().padStart(2, '0')}`
}

export function formatMinuteWithMeridiem(minute: number): string {
  const m = normalizeMinute(minute)
  const ampm = Math.floor(m / 60) >= 12 ? 'PM' : 'AM'
  return `${formatMinute12(m)} ${ampm}`
}

export function formatMinute24(minute: number): string {
  const m = normalizeMinute(minute)
  const h24 = Math.floor(m / 60)
  const mm = m % 60
  return `${h24.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

export function formatShortWeekday(iso: string): string {
  const d = new Date(iso)
  return DAY_NAMES[d.getUTCDay()]
}

export function formatShortMonthDay(iso: string): string {
  const d = new Date(iso)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatShortWeekdayMonthDay(iso?: string): string {
  if (!iso) return '—'
  return `${formatShortWeekday(iso)} ${formatShortMonthDay(iso)}`
}

export function formatCompactNumber(
  value: number,
  options: { compactThousandsAt?: number; localeBelowThreshold?: boolean } = {},
): string {
  const { compactThousandsAt = 1_000, localeBelowThreshold = false } = options
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= compactThousandsAt) return `${(value / 1_000).toFixed(1)}K`
  return localeBelowThreshold ? value.toLocaleString() : `${value}`
}
