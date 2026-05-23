import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'a11y-high-contrast'

export type ContrastPreference = 'default' | 'high'

function readStored(): ContrastPreference | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'high' || v === 'default') return v
  } catch {
    /* ignore */
  }
  return null
}

function systemPrefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: more)').matches
}

function applyToDocument(highContrast: boolean) {
  const root = document.documentElement
  if (highContrast) {
    root.setAttribute('data-high-contrast', 'true')
  } else {
    root.removeAttribute('data-high-contrast')
  }
}

interface A11yPreferencesContextValue {
  contrast: ContrastPreference
  highContrastActive: boolean
  setContrast: (mode: ContrastPreference) => void
  toggleHighContrast: () => void
}

const A11yPreferencesContext = createContext<A11yPreferencesContextValue | null>(null)

export function A11yPreferencesProvider({ children }: { children: ReactNode }) {
  const [contrast, setContrastState] = useState<ContrastPreference>(() => {
    const stored = readStored()
    if (stored) return stored
    return systemPrefersHighContrast() ? 'high' : 'default'
  })

  const highContrastActive = contrast === 'high'

  useEffect(() => {
    applyToDocument(highContrastActive)
  }, [highContrastActive])

  useEffect(() => {
    const stored = readStored()
    if (stored) return

    const mq = window.matchMedia('(prefers-contrast: more)')
    const onChange = () => {
      setContrastState(mq.matches ? 'high' : 'default')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setContrast = useCallback((mode: ContrastPreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    setContrastState(mode)
  }, [])

  const toggleHighContrast = useCallback(() => {
    setContrast(highContrastActive ? 'default' : 'high')
  }, [highContrastActive, setContrast])

  const value = useMemo(
    () => ({
      contrast,
      highContrastActive,
      setContrast,
      toggleHighContrast,
    }),
    [contrast, highContrastActive, setContrast, toggleHighContrast]
  )

  return (
    <A11yPreferencesContext.Provider value={value}>
      {children}
    </A11yPreferencesContext.Provider>
  )
}

export function useA11yPreferences() {
  const ctx = useContext(A11yPreferencesContext)
  if (!ctx) {
    throw new Error('useA11yPreferences must be used within A11yPreferencesProvider')
  }
  return ctx
}
