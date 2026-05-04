import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'

export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-[1.1]">
          About wheres<span className="text-no">xi</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Origin story. Mostly true.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6 text-sm leading-relaxed">
          <p>
            It started, as these things do, by the seventh floor kitchen.
            Taylor, being the silly guy that he is, walks into the office late.
            The Foundations team noticed and started a bet.
          </p>
          <p>
            For a while it was just verbal bets, sometimes with the risk of
            getting the winner a snack from the kitchen.
          </p>
          <p>That was supposed to be the end of it.</p>
          <p>
            Today, wheresxi is what happens when a small team has a lot of
            opinions about one guy's commute and slightly too much free time.
            We do not endorse problem gambling. We do not condone tampering
            with Taylor. We absolutely encourage you to read the{' '}
            <Link
              to="/rules"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              rules
            </Link>
            .
          </p>
          <p className="text-muted-foreground">
            — The wheresxi team (anonymous, for OpSec reasons)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
