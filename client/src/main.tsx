import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './contexts/AuthContext'
import { CookieConsentProvider } from './contexts/CookieConsentContext'
import { A11yPreferencesProvider } from './contexts/A11yPreferencesContext'
import './styles/tokens.css'
import './styles/filter-bar.css'
import './styles/shared-ui.css'
import './styles/match-card.css'
import './index.css'
import './styles/tournament-girls.css'
import './styles/tournament-worldcup.css'
import './styles/a11y-high-contrast.css'
import './styles/btn-gated.css'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || (import.meta.env.DEV ? '1234567890-mock.apps.googleusercontent.com' : '');

if (import.meta.env.PROD && !GOOGLE_CLIENT_ID) {
  throw new Error('VITE_GOOGLE_CLIENT_ID is required in production builds');
}

const VITE_CHUNK_RELOAD_KEY = 'vite-chunk-reload'

sessionStorage.removeItem(VITE_CHUNK_RELOAD_KEY)
for (const key of Object.keys(sessionStorage)) {
  if (key.startsWith('chunk-reload:')) {
    sessionStorage.removeItem(key)
  }
}

window.addEventListener('vite:preloadError', (event) => {
  if (!sessionStorage.getItem(VITE_CHUNK_RELOAD_KEY)) {
    event.preventDefault()
    sessionStorage.setItem(VITE_CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <CookieConsentProvider>
        <A11yPreferencesProvider>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </GoogleOAuthProvider>
        </A11yPreferencesProvider>
      </CookieConsentProvider>
    </HelmetProvider>
  </StrictMode>,
)
