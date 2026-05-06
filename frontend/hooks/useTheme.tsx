import { createContext, useContext } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_COOKIE = 'wheresxi-theme'
const LEGACY_LOCAL_STORAGE_KEY = 'wheresxi-theme'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const pair = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : null
}

export function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ')
}

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function initialTheme(): Theme {
  const cookieTheme = readCookie(THEME_COOKIE)
  if (isTheme(cookieTheme)) return cookieTheme

  const legacyTheme =
    typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY)
  if (isTheme(legacyTheme)) return legacyTheme

  // Default dark so wheresxi doesn't unexpectedly boot into light mode for
  // users whose OS prefers light. They can still opt into light via the
  // wallet dropdown.
  return 'dark'
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }
  return value
}
