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

## Required Environment Variables
Create a locally-scoped `.env` file with the following variables:
```
VITE_API_URL=http://localhost:5000
```
