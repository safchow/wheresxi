import { Cookie, DollarSign, ShieldOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Reward = {
  icon: React.ReactNode
  tierShort: string
  tierFull: string
  title: string
  description: React.ReactNode
  accent: string
}

const REWARDS: Reward[] = [
  {
    icon: <Cookie className="h-6 w-6" />,
    tierShort: '1M',
    tierFull: '1,000,000 credits',
    title: 'Office snack of your choice',
    description: (
      <>
        Pick anything in the kitchen. Delivered to your desk by the nearest
        intern.
      </>
    ),
    accent: 'from-emerald-400/25',
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    tierShort: '1B',
    tierFull: '1,000,000,000 credits',
    title: 'Extra $20 on Hunger Hub',
    description: (
      <>
        Subject to finance approval (will not happen).
      </>
    ),
    accent: 'from-amber-400/25',
  },
  {
    icon: <ShieldOff className="h-6 w-6" />,
    tierShort: '1T',
    tierFull: '1,000,000,000,000 credits',
    title: 'Skip one support shift',
    description: (
      <>
        Subject to your manager's approval and Zendesk being down.
      </>
    ),
    accent: 'from-fuchsia-400/25',
  },
]

export function RewardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
          Rewards
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn your imaginary internet points into marginally more tangible
          treats. Redemption requires your credits in good standing.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {REWARDS.map((r) => (
          <RewardCard key={r.tierShort} reward={r} />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-5 text-center text-sm text-muted-foreground">
        More tiers coming once anyone hits the first one.
      </div>
    </div>
  )
}

function RewardCard({ reward }: { reward: Reward }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div
          className={cn(
            'relative bg-gradient-to-b to-transparent p-5',
            reward.accent,
          )}
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-background/60 text-foreground ring-1 ring-border">
            {reward.icon}
          </div>

          <div className="mt-4">
            <div className="font-mono text-5xl font-bold leading-none tracking-tight">
              {reward.tierShort}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {reward.tierFull}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-5">
          <div className="text-base font-semibold">{reward.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {reward.description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
