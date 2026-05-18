# Project Context: Ramadan Tournament

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Bootstrap 5.
- **Backend**: Node.js, Express, **PostgreSQL (Prisma)**, **Redis (ioredis)**, TypeScript.
- **Data**: JSON in `data/` for bootstrap seed; Postgres for runtime.
- **DevOps**: Render (API + Postgres + Redis), Vercel (Frontend).

## Architecture
- **Monorepo**: `client`, `server`, `data/`, `.incoming/` (PRD and drops).
- **Data Layer**: Prisma ORM; boys/girls as separate seasons (`division`). Redis caches hot reads (`rt:` keys). Legacy controllers use thin Mongoose-shaped adapters over Prisma.
- **Bootstrap**: No Mongo migration — `npm run db:migrate` and `npm run db:seed` in `server/` after `DATABASE_URL` is set. Production seeded May 2026 (boys season, teams/matches from `data/*.json`).
- **Automation**: Core tournament automation (stats calculations, AI summarizations, CSV imports) is handled natively within the Node.js API processes. Python remains strictly for specific peripheral tasks such as syncing photos (`sync_photos.py`) and fetching external alarm data periodically (`fetch_alarms.py`).

## Environment variables (who needs what)

| Variable | Render API | Vercel / client | Notes |
|----------|------------|-----------------|--------|
| `DATABASE_URL` | Yes (internal URL) | No | Postgres only on server |
| `REDIS_URL` | Yes (internal) | No | |
| `JWT_SECRET`, `ADMIN_*` | Yes | No | |
| `GEMINI_API_KEY`, SMTP | Yes (optional) | No | Automation / email |
| `GOOGLE_CLIENT_ID` | Yes (if Google login) | Optional `VITE_GOOGLE_CLIENT_ID` | Same OAuth client ID for browser button |
| `VITE_API_URL` | No | Yes | Base URL of API host, no `/api` suffix required (client adds `/api`) |

Local dev: `server/.env` for backend; `client/.env` or root `.env` with `VITE_API_URL=http://localhost:5000` when running Vite.

## Accessibility (Israeli Standard IS 5568)

**All UI and frontend changes must comply with Israeli Standard ת"י 5568 (WCAG 2.1 Level AA).** This is a legal requirement in Israel, not optional polish.

| Resource | Purpose |
|----------|---------|
| [.cursor/rules/israeli-accessibility-is5568.mdc](.cursor/rules/israeli-accessibility-is5568.mdc) | Persistent rule for Cursor agents editing `client/**` |
| [Review/is-5568-wcag-aa-pass-may-2026.md](Review/is-5568-wcag-aa-pass-may-2026.md) | May 2026 review (mostly resolved; coordinator contact still open) |
| [status.md](status.md) | Checklist and completion status |
| [client/src/pages/Accessibility.tsx](client/src/pages/Accessibility.tsx) | Public accessibility statement (נגישות) |

When fixing or adding UI: use native buttons/links, labels, focus, keyboard, contrast, Hebrew `lang`, and keep `/accessibility` accurate (real coordinator contact before production).

## Current Focus
- **Phase 1.5 (in progress):** Girls **read** scaffold is live (`/girls`, `*-girls` APIs, switcher). Admin can manage girls season/points and **news per division** (selector in Admin → חדשות). Team **writes** on `/api/teams-girls` use the active girls season; archive list/detail accepts `?division=boys|girls`.
- **Still legacy / pre-PRD:** Profile join flows use `mappedPlayerInfo` and Captain role; no invoice or `season_registrations`; user mapping and votes are football-season scoped.
- **Phase 2 (next):** Registration per [`.incoming/PRD-database-schema.md`](.incoming/PRD-database-schema.md) (invoice codes, join/transfer, `active_division`).
- **Deploy:** Render API must include latest `*-girls` routes and division write fixes.
- Optional: legacy Mongo script cleanup; Prisma `archive-season` script.

## Recent Changes
- **May 2026 — Phase 1.5:** Girls `-girls` client routes, tournament switcher, `PointsStatsService`, `/api/teams-girls`, `/api/stats-girls`, `/api/news-girls`; division-aware news CRUD, team mutations, archive queries; admin news division selector.
- **May 2026 — Postgres + Redis rebuild:** Greenfield Prisma schema, Render deploy, successful `db:migrate` + `db:seed`. Iftar API removed from server; Mongo scripts excluded from production build. Bracket seed uses `matchId` only when match exists (playoff placeholders 201+ unlinked until sync).
- **Career Documentation**: Updated `resume.md` to showcase the Ramadan Tournament project as a premier full-stack achievement, highlighting MERN stack mastery, AI integration (Gemini), and advanced RTL/security implementations.
- Consolidated Admin mappings, registrations, and player management into a unified Roster view.
- Added `bio` field to Player records and user profile editing flow.
- Implemented real-time Avatar synchronization to official Team records.
- Refactored player profile data flow (backend hydration maps directly from Team database).
- Aligned UI button and table styles between user mapping panels and matches management.
- **Database Integrity**: Fixed cross-team `memberId` collisions and implemented global ID generation.
- **Navigation**: Implemented session-aware links in the footer and extended smart polling to all main data pages (Teams, Stats, Schedule, Dashboard). Fixed expanded team scrolling in `Teams.tsx` using top-aligned manual calculation (100px offset). Improved Iftar widget visibility with `z-index: 2000` and removed programmatic sticky tabs behavior to resolve mobile horizontal scroll issues.
- **UI Enhancements**: Added a centered `top-scorer.svg` badge above the 1st place scorer in `MVPs.tsx` with a refined 5px spacing.
- **Voting Reliability**: Resolved a race condition where voting status was checked before auth state was ready; implemented `authLoading` synchronization in `MVPs.tsx` and `Teams.tsx`.
- **Security & Registration**: Built an Email Verification (OTP) system. New registrants must verify a 6-digit code sent via SMTP to activate their accounts. `Login.tsx` now handles the verification flow and blocks unverified logins.
- **Playoff Automation**: Implemented automated knockout schedule generation. Admins can sync playoff matchups from the Admin Panel based on current standings, automatically creating semi-finals for March 17th and final placeholders for March 18th.
- **Stats Automation**: Migrated from GitHub Actions to a server-side `AutomationService`. Admins can manually trigger a news update via the Admin Panel, which calculates stats, detects changes via `stats_snapshots`, and generates an AI summary in Hebrew using Gemini 1.5 Flash.
- Implementation of photo approval system.
- Match time support with Jerusalem timezone.
- Iftar countdown timer widget.
- UI refinements with mirrored foregrounds and Adygea flag.
- Fixed 404 error on `/api/stats` endpoint.
- Clarified Admin authentication flow for external tools.
- **CSS Cleanup**: Removed stale match styles from `index.css`. Scoped conflicting class names in `Dashboard.css` under `.dashboard-page` parent, and `.team-name` in `Stats.css` under `.stats-page`, to prevent global CSS bleed in Vite's bundled output.
- **Bug Fix**: Resolved syntax error in `Teams.tsx` (identifier following numeric literal).
- **Bug Fix**: Fixed a syntax error in `IftarTimer.css` and removed a global `pointer-events: auto` wildcard selector in both widget CSS files that was causing mobile UI (like navigation tabs) to be unclickable when the widgets were minimized.
- **Bug Fix**: Fixed moon illumination percentage staying identical across days; `IftarTimer` now computes fractional days for real-time moon phase tracking.
- **Polling Refinement**: Restricted smart polling logic (30s background refresh) to a strict 20:00–23:59 tournament window across Dashboard, Teams, and Stats pages. Added a logic guard in `Dashboard.tsx` to ensure polling ONLY occurs on days when matches are actually scheduled, preventing wasteful pings during the off-season or early morning hours.
- **SEO & Accessibility**: Implemented a comprehensive SEO engine using `react-helmet-async`. Every main view (Dashboard, Teams, Schedule, Stats, Player Zone) now has unique, localized metadata, Open Graph tags, and canonical links. Updated `sitemap.xml` and `robots.txt`. Added descriptive `alt` tags to branding images for improved accessibility and search indexing.
- **IS 5568 / WCAG 2.1 AA (May 2026)**: Pass 1 + pass 2 code fixes (modal portal, inert scope, MVPs guard, admin tabs, Dashboard/Login). Coordinator name/phone placeholders — update at deploy. See [status.md](status.md) and [Review/is-5568-wcag-aa-pass-may-2026.md](Review/is-5568-wcag-aa-pass-may-2026.md). Agent rule: [.cursor/rules/israeli-accessibility-is5568.mdc](.cursor/rules/israeli-accessibility-is5568.mdc).
- **Archive UI Polish & Data Fixes (Mar 2026)**:
  - Harmonized Archive styling with the rest of the application using standard project CSS variables.
  - Fixed data mapping mismatches (e.g., `wins` vs `won`) in the historical standings table.
  - Relocated top scorers to a full-width table and converted knockout matches to card format for consistency.
- **Model Integrity**: Resolved Mongoose schema type conflicts in `SeasonArchive.ts` by relaxing mixed-field interfaces.
- **Post-Ramadan Cleanup**: Transitioned the Iftar countdown widget to an inactive state in `App.tsx`.
- **Workspace Chroma skill**: Personal Cursor skill at `~/.cursor/skills/workspace-chroma/` indexes this repo into `.chroma/` (gitignored) for explicit `/index-workspace` and `/search-context` queries. Local embeddings via `all-MiniLM-L6-v2`; verified index (128 files, 926 chunks).
