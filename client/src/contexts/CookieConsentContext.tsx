import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'cookie-consent'

export type CookieConsent = 'accepted' | 'essential' | null

function readConsent(): CookieConsent {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'accepted' || v === 'essential') return v
  } catch {
    /* ignore */
  }
  return null
}

interface CookieConsentContextValue {
  consent: CookieConsent
  ready: boolean
  setConsent: (value: Exclude<CookieConsent, null>) => void
  showBanner: boolean
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<CookieConsent>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setConsentState(readConsent())
    setReady(true)
  }, [])

  const setConsent = useCallback((value: Exclude<CookieConsent, null>) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
    setConsentState(value)
  }, [])

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        ready,
        setConsent,
        showBanner: ready && consent === null,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider')
  }
  return ctx
}
