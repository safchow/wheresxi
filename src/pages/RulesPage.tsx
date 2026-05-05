import {
  AlarmClock,
  Ban,
  Banknote,
  CalendarDays,
  Eye,
  ScrollText,
  Skull,
  Trophy,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Rule = {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
}

const RULES: Rule[] = [
  {
    icon: <ScrollText className="h-5 w-5" />,
    title: 'The fine print',
    body: (
      <>
        Outcomes are resolved when Taylor walks through the door, not by whoever saw
        him in the elevator first.
      </>
    ),
  },
  {
    icon: <AlarmClock className="h-5 w-5" />,
    title: 'When guesses close',
    body: (
      <>
        Guesses lock at <span className="font-mono">12:00 AM ET</span> the day
        of.
      </>
    ),
  },
  {
    icon: <CalendarDays className="h-5 w-5" />,
    title: 'When the market runs',
    body: (
      <>
        Tuesday, Wednesday, and Thursday. We don't run the market on Monday or
        Friday because Taylor is "working from home." We checked his Steam
        activity. He is not.
      </>
    ),
  },
  {
    icon: <Trophy className="h-5 w-5" />,
    title: 'How you get paid',
    body: (
      <ul className="space-y-1">
        <li>
          <span className="font-mono">2×</span> — correct half-hour window
        </li>
        <li>
          <span className="font-mono">4×</span> — correct 15-minute window
        </li>
        <li>
          <span className="font-mono">12×</span> — correct 5-minute window
        </li>
        <li>
          <span className="font-mono">60×</span> — exact minute
        </li>
      </ul>
    ),
  },
  {
    icon: <Skull className="h-5 w-5" />,
    title: 'Bust conditions',
    body: (
      <ul className="space-y-1.5">
        <li>
          <strong>Taylor arrives before 9:00 AM.</strong> Everyone busts. This
          has never happened but we're contractually required to mention it.
        </li>
        <li>
          <strong>Taylor arrives after 10:30 AM.</strong> Everyone busts. This
          happens.
        </li>
        <li>
          <strong>Taylor is WFH or sick.</strong> Everyone busts. "Headache"
          counts as sick.
        </li>
      </ul>
    ),
  },
  {
    icon: <Ban className="h-5 w-5" />,
    title: 'Do not tamper with Taylor',
    body: (
      <>
        Observe Taylor. Report on Taylor. Do <em>not</em> call Taylor at
        11:58&nbsp;PM to bribe him into punctuality. Interfering with Taylor's
        commute voids your account, and possibly your friendship
        with Taylor.
      </>
    ),
  },
  {
    icon: <Eye className="h-5 w-5" />,
    title: 'Insider trading',
    body: (
      <>
        Allowed and encouraged. In fact, please do.
      </>
    ),
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: 'Bankruptcy',
    body: (
      <>
        Hit zero credits? Declare bankruptcy for a fresh{' '}
        <span className="font-mono">500 cr</span>. Must be flat broke — one
        credit and you're still solvent. Reputation damaged forever.
      </>
    ),
  },
]

export function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
          Rules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Short. Only eight. None of them protect you from Taylor.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {RULES.map((r, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-foreground">
                {r.icon}
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Rule {i + 1}
                </div>
                <h2 className="text-base font-semibold">{r.title}</h2>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.body}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-5 text-center text-sm text-muted-foreground">
        Credits are not legal tender in any jurisdiction.
      </div>
    </div>
  )
}
