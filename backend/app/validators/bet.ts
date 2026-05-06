import vine from '@vinejs/vine'

export const placeBetValidator = vine.compile(
  vine.object({
    marketDayId: vine.string().trim().minLength(1),
    granularity: vine.enum(['HALF_HOUR', 'QUARTER_HOUR', 'FIVE_MIN', 'EXACT']),
    bucketStartMinute: vine.number().min(0).max(1440).optional(),
    bucketEndMinute: vine.number().min(0).max(1440).optional(),
    exactMinute: vine.number().min(0).max(1440).optional(),
    wager: vine.number().min(1).max(1_000_000),
  }),
)

export const resolveMarketValidator = vine.compile(
  vine.object({
    date: vine.string().trim(),
    arrivedAtMinute: vine.number().min(0).max(1440).optional().nullable(),
    bustReason: vine
      .enum(['BEFORE_NINE', 'AFTER_TENTHIRTY', 'WFH_SICK'])
      .optional()
      .nullable(),
  }),
)

export const refundMarketValidator = vine.compile(
  vine.object({
    date: vine.string().trim(),
  }),
)
