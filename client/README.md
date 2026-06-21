# Ramadan Tournament - React Client

The frontend application for the Ramadan Tournament management system. Built as a Single Page Application (SPA) utilizing modern React and Vite.

## Tech Stack
- **Framework**: React 18, Vite
- **Language**: TypeScript
- **Styling**: Vanilla CSS, Bootstrap 5 (for grid and base layout)
- **Routing**: React Router DOM (v7)
- **SEO Elements**: React Helmet Async

## Key Capabilities
- **Real-Time Dashboards**: View standings, scorers, matching, and schedules with Smart Background Polling logic ensuring real-time stats during game hours.
- **Widget Integrations**: Iftar countdown timer, realtime Rocket Alarms statistics.
- **Robust Auth Flow**: Integrated Google OAuth 2.0 and standard credentials backed by a stringent Email Verification (OTP) challenge requirement.
- **Mobile First / RTL Formats**: Full Hebrew Right-To-Left presentation with meticulously tuned UI/UX layouts.

## Scripts

- `npm run dev` - Starts the Vite development server.
- `npm run build` - Type-checks definitions and builds the production app.
- `npm run lint` - Lints the codebase using ESLint.

## Environment variables

Copy [`.env.example`](.env.example) to `client/.env`. Vite loads **only** `client/.env` (`envDir` is the client package root).

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API host for production builds and dev proxy target (local: `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth button (required in production builds) |
| `VITE_SITE_URL` | Canonical URL for sitemap/OG (no trailing slash) |
| `VITE_WORLD_CUP_*` | Optional World Cup UI flags |

Local dev: axios uses relative `/api` (Vite proxy); `VITE_API_URL` still configures the proxy target in [`vite.config.ts`](vite.config.ts).

Backend secrets live in [`server/.env`](../server/.env.example), not here.
