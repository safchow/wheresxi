import { useState } from 'react'
import { CheckCircle2, Link2, Loader2, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useLinkSlackAccount } from '@/client/queries'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'

export function SlackLinkPage() {
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const { user } = useAuth()
  const linkSlack = useLinkSlackAccount()
  const [message, setMessage] = useState<string | null>(null)

  async function handleLink() {
    if (!code || linkSlack.isPending) return
    setMessage(null)
    try {
      await linkSlack.mutateAsync({ code })
      setMessage(
        'Slack is linked. You can return to Slack and use /wheresxi bets or /wheresxi bet.',
      )
    } catch (error) {
      setMessage(
        extractApiError(error) ??
          'Could not link Slack. Run /wheresxi link again.',
      )
    }
  }

  const isSuccess = linkSlack.isSuccess

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Link2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Link Slack</h1>
          <p className="text-sm text-muted-foreground">
            Connect your Slack user to @{user?.username} so Slack bets use your
            wheresxi account.
          </p>
        </div>
      </div>

      {!code ? (
        <Status
          kind="error"
          text="This link is missing a code. Run /wheresxi link again from Slack."
        />
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <span className="text-muted-foreground">Link code: </span>
            <span className="font-mono">{code}</span>
          </div>

          <Button
            onClick={handleLink}
            disabled={linkSlack.isPending || isSuccess}
            className="w-full"
          >
            {linkSlack.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : isSuccess ? (
              'Linked'
            ) : (
              'Link Slack account'
            )}
          </Button>

          {message ? (
            <Status kind={isSuccess ? 'success' : 'error'} text={message} />
          ) : null}
        </div>
      )}
    </div>
  )
}

function Status({ kind, text }: { kind: 'success' | 'error'; text: string }) {
  const Icon = kind === 'success' ? CheckCircle2 : XCircle
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm">
      <Icon
        className={
          kind === 'success'
            ? 'mt-0.5 h-4 w-4 text-yes'
            : 'mt-0.5 h-4 w-4 text-no'
        }
      />
      <p>{text}</p>
    </div>
  )
}
