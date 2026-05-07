import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { queryClient } from './client/queryClient.ts'
import App from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'
import { AboutPage } from './pages/AboutPage.tsx'
import { AdminPage } from './pages/AdminPage.tsx'
import { ChangelogPage } from './pages/ChangelogPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LeaderboardPage } from './pages/LeaderboardPage.tsx'
import { MyBetsPage } from './pages/MyBetsPage.tsx'
import { RewardsPage } from './pages/RewardsPage.tsx'
import { RulesPage } from './pages/RulesPage.tsx'
import { SignupPage } from './pages/SignupPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'bets', element: <MyBetsPage /> },
      { path: 'rewards', element: <RewardsPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
