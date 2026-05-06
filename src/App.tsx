import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'

const PUBLIC_ROUTES = new Set(['/signup'])

function App() {
  const { isLoggedIn, isLoading, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const isPublicRoute = PUBLIC_ROUTES.has(pathname)
  const isAdminRoute = pathname.startsWith('/admin')

  if (isLoggedIn && isPublicRoute) {
    return <Navigate to="/" replace />
  }

  if (isPublicRoute) {
    return <Outlet />
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginPage />
  }

  if (isAdminRoute && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default App
