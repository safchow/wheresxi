import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ThemeContext,
  initialTheme,
  writeCookie,
} from '@/hooks/useTheme'

type Theme = 'light' | 'dark'

const THEME_COOKIE = 'wheresxi-theme'
const LEGACY_LOCAL_STORAGE_KEY = 'wheresxi-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = (next: Theme) => {
    setThemeState(next)
  }

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeCookie(THEME_COOKIE, theme)
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () =>
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
