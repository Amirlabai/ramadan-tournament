import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './contexts/AuthContext'
import { CookieConsentProvider } from './contexts/CookieConsentContext'
import { A11yPreferencesProvider } from './contexts/A11yPreferencesContext'
import './styles/tokens.css'
import './index.css'
import './styles/tournament-girls.css'
import './styles/a11y-high-contrast.css'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1234567890-mock.apps.googleusercontent.com';

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
