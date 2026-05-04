import { useState } from 'react'
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'

export function SignupPage() {
  const [params] = useSearchParams()
  const inviteToken = params.get('inviteToken')

  if (!inviteToken) {
    return <InviteRequired />
  }

  return <SignupForm inviteToken={inviteToken} />
}

function SignupForm({ inviteToken }: { inviteToken: string }) {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)

    const trimmedName = name.trim()
    const trimmedUsername = username.trim()

    if (!trimmedName || !trimmedUsername || !password || !confirm) {
      setError('All fields are required.')
      return
    }
    if (/\s/.test(trimmedUsername)) {
      setError('Username can\u2019t contain spaces.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don\u2019t match.")
      return
    }

    setLoading(true)
    try {
      await signup({
        inviteToken,
        username: trimmedUsername,
        name: trimmedName,
        password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not create your account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            wheres<span className="text-no">xi</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A prediction market for one (1) guy.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">Create your account</span>
            <Badge
              variant="yes"
              className="gap-1 rounded-md text-[10px]"
              title={`Invite token: ${inviteToken}`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Invite verified
            </Badge>
          </div>

          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Taylor Smith"
                autoComplete="name"
                autoFocus
              />
            </Field>

            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. tardy_sentinel"
                autoComplete="username"
                spellCheck={false}
                className="font-mono"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="font-mono"
              />
            </Field>

            <Field label="Confirm password">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="font-mono"
              />
            </Field>
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-no/40 bg-no/10 px-3 py-2 text-xs text-no">
              {error}
            </div>
          )}

          <Button type="submit" className="mt-4 w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link to="/" className="font-medium text-foreground hover:underline">
              Log in
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] text-muted-foreground">
          using invite {inviteToken}
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function InviteRequired() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            wheres<span className="text-no">xi</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A prediction market for one (1) guy.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-no">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Invite required</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign-ups happen only via an invite link. Find someone at the
                office who has one. Or be a more interesting person at parties.
              </p>
            </div>
          </div>

          <Link to="/">
            <Button variant="outline" className="mt-4 w-full">
              Back to log in
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
