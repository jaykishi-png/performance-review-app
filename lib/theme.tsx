'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Theme state for the Calibr portals.
 *
 * Three settings: 'light', 'dark', or 'system' (follow the OS). The resolved
 * value is written to <html data-theme> — every colour in the app reads from
 * the CSS variables keyed on that attribute, so switching is a single DOM
 * write rather than a re-render of the styles.
 *
 * The stored preference is applied by an inline script before first paint (see
 * THEME_INIT_SCRIPT); doing it in an effect instead would show the wrong theme
 * for a frame on every load.
 */

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'calibr-theme'
const DEFAULT_SETTING: ThemeSetting = 'dark'

/**
 * Runs before paint in the document head. Kept dependency-free and small, and
 * defensive about storage: a private window or blocked site data must not stop
 * the page rendering.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('${STORAGE_KEY}') || '${DEFAULT_SETTING}';
    var d = s === 'dark' || (s === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', '${DEFAULT_SETTING}');
  }
})();
`.trim()

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

function resolve(setting: ThemeSetting): ResolvedTheme {
  if (setting === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return setting
}

function readStored(): ThemeSetting {
  if (typeof window === 'undefined') return DEFAULT_SETTING
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return DEFAULT_SETTING
}

type ThemeContextValue = {
  setting: ThemeSetting
  theme: ResolvedTheme
  setTheme: (next: ThemeSetting) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start on the default so server and first client render agree; the real
  // preference is already on <html> from the init script, and the effect below
  // syncs React's copy of it without changing what is on screen.
  const [setting, setSetting] = useState<ThemeSetting>(DEFAULT_SETTING)
  const [theme, setResolved] = useState<ResolvedTheme>(resolve(DEFAULT_SETTING))

  useEffect(() => {
    const stored = readStored()
    setSetting(stored)
    setResolved(resolve(stored))
  }, [])

  // Track the OS setting only while following it.
  useEffect(() => {
    if (setting !== 'system') return
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    const onChange = () => setResolved(systemPrefersDark() ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setting])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = useCallback((next: ThemeSetting) => {
    setSetting(next)
    setResolved(resolve(next))
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* preference just won't persist */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolve(setting) === 'dark' ? 'light' : 'dark')
  }, [setting, setTheme])

  return (
    <ThemeContext.Provider value={{ setting, theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Usable outside a provider: the portals are large and mounted in several
 * places, and a missing provider should degrade to "the theme on <html>"
 * rather than crash the page.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  const [fallback, setFallback] = useState<ResolvedTheme>('dark')

  useEffect(() => {
    if (ctx) return
    const current = document.documentElement.getAttribute('data-theme')
    setFallback(current === 'light' ? 'light' : 'dark')
  }, [ctx])

  if (ctx) return ctx

  return {
    setting: fallback,
    theme: fallback,
    setTheme: (next: ThemeSetting) => {
      const r = resolve(next)
      document.documentElement.setAttribute('data-theme', r)
      setFallback(r)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
    },
    toggle: () => {
      const r: ResolvedTheme = fallback === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', r)
      setFallback(r)
      try {
        localStorage.setItem(STORAGE_KEY, r)
      } catch {
        /* ignore */
      }
    },
  }
}
