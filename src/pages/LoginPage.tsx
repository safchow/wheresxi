import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { extractApiError } from '@/lib/errors'

export function LoginPage() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await login({ username: username.trim(), password })
    } catch (err) {
      setError(extractApiError(err) ?? 'Could not log in')
    } finally {
      setLoading(false)
    }
  }

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

        <form
          onSubmit={handleLogin}
          className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">Log in</span>
            <Badge variant="outline" className="text-[10px]">
              Invite only
            </Badge>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="username"
                className="text-xs font-medium text-muted-foreground"
              >
                Username
              </label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. taylor_fanboy"
                autoComplete="username"
                autoFocus
                className="mt-1 font-mono"
                spellCheck={false}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 font-mono"
              />
            </div>
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
                Logging in…
              </>
            ) : (
              'Log in'
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            No sign-ups. Find someone at the office who has an invite.
          </p>
        </form>
      </div>
    </div>
  )
}
