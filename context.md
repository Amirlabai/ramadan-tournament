# Project Context: Ramadan Tournament

## Tech Stack
- **Frontend**: React 19, Vite 7, TypeScript, Bootstrap 5, PWA (`vite-plugin-pwa`), `react-helmet-async`.
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
| `PERSONAL_ID_KEY` | Yes (prod) | No | 32-byte base64; AES-256-GCM for `personal_id_enc` |
| `CORS_ORIGINS` | Yes (optional) | No | Comma-separated; defaults include Vercel + localhost |
| `GEMINI_API_KEY`, SMTP | Yes (optional) | No | Automation / email |
| `GOOGLE_CLIENT_ID` | Yes (if Google login) | Optional `VITE_GOOGLE_CLIENT_ID` | Same OAuth client ID for browser button |
| `VITE_API_URL` | No | Yes | Base URL of API host, no `/api` suffix required (client adds `/api`) |
| `VITE_SITE_URL` | No | Yes | Canonical URL for SEO, sitemap, OG (no trailing slash) |
| `WORLD_CUP_ENABLED`, `FOOTBALL_DATA_API_KEY` | Yes (optional) | No | Temporary WC proxy; see [Review/world-cup-phase.md](Review/world-cup-phase.md) |
| `WORLD_CUP_ONLY` | Yes (optional) | No | Ignored when `DATABASE_URL` is set (Jun 2026 dual-mode fix) |
| `VITE_WORLD_CUP_ENABLED`, `VITE_DUAL_TOURNAMENT` | No | Yes (optional) | `VITE_DUAL_TOURNAMENT=true` in [`client/.env.production`](client/.env.production) forces boys+girls+WC switcher even if Vercel still has stale `VITE_WORLD_CUP_ONLY` |

Local dev: [`server/.env`](server/.env) for backend (copy from [`server/.env.example`](server/.env.example)); [`client/.env`](client/.env) for `VITE_*` (copy from [`client/.env.example`](client/.env.example)). **Do not use a repo-root `.env`** — the server loads only `server/.env`. In dev, the client uses Vite `/api` proxy and `withCredentials` for httpOnly session cookies (`rt_session` / `rt_player` on the API host).

**Local dev without Postgres (Render paused):** `npm run dev:mock` from repo root (or `server/`). Sets `MOCK_DEV_DATA=1` via `server/env.mock` and serves read-only API from `data/*.json` (teams, matches, news, computed stats). Admin login: `admin` / `admin123` (see `server/env.mock`). Writes and girls season return 404/503 until Postgres is back.

## Client shell and navigation (May 2026)

- **Main app routes** (`/`, `/teams`, …): `AppShell` with header, news banner, `app-body` grid (main + right sidebar), footer.
- **Legal routes** (`/about`, `/privacy`, `/terms`, `/accessibility`): standalone `LegalPageLayout` (no tournament chrome); prerendered at build.
- **Nav**: [`TournamentSidebar`](client/src/components/TournamentSidebar.tsx) + [`mainNavItems.ts`](client/src/utils/mainNavItems.ts). Desktop: sticky sidebar on the right (RTL). Mobile: off-canvas drawer + edge drag handle; horizontal swipe on `#main-content` moves to adjacent tab (non-looping).
- **SEO**: [`seoConfig.ts`](client/src/config/seoConfig.ts), per-route meta via [`SEO.tsx`](client/src/components/SEO.tsx) (`pathname` + `useLocation` fallback; `noindex` on `/login`, `/admin`, `/profile`, `/player-zone`). Prebuild regenerates `public/sitemap.xml`, `public/robots.txt`, and `public/og-image.png`. Prerender bakes canonical/OG head for all sitemap paths and `noindex` for auth routes (`dist/schedule/index.html`, etc.).
- **Cookies**: [`CookieConsentProvider`](client/src/contexts/CookieConsentContext.tsx); analytics only after accept.

## Client production build (Vercel)

- Default: full build with prerender (legal pages + public SEO head + auth `noindex` baked to `dist/*/index.html`). `vite-prerender-plugin` + `vite-plugin-pwa` can leave open handles; [`client/vite.config.ts`](client/vite.config.ts) uses `force-exit-after-build` so `npm run build` exits (same iron-sight workaround).
- Fast path: `$env:PRERENDER='0'; npm run build` — SPA only, ~3s, no legal static HTML.
- Vercel [`client/vercel.json`](client/vercel.json): no `PRERENDER=0` — production gets baked legal routes. Deploy adds ~5–15s vs fast path, not minutes, if force-exit is present.

## Dual tournament UI themes

| Branch | Activation | Styles |
|--------|------------|--------|
| Boys (football) | `data-tournament="boys"` on `.app` (default) | Green/yellow — primitives in [`client/src/styles/tokens.css`](client/src/styles/tokens.css) |
| Girls (points) | `data-tournament="girls"` when pathname is `/girls` or `*-girls` | Pastel rose/lavender — [`client/src/styles/tournament-girls.css`](client/src/styles/tournament-girls.css) overrides `--color-*` on `[data-tournament="girls"]` |
| World Cup (temporary) | `data-tournament="worldcup"` on `/world-cup/*` when `VITE_WORLD_CUP_ENABLED=true` | Blue/gold — [`client/src/styles/tournament-worldcup.css`](client/src/styles/tournament-worldcup.css). Read-only proxy to football-data.org; reversion guide: [Review/world-cup-phase.md](Review/world-cup-phase.md) |

- **Palette (boys):** edit `--color-primary`, `--color-secondary`, etc. in `tokens.css` only. Legacy names (`--primary`, `--primary-green`, `--bg`, …) alias those primitives for existing CSS.
- Import order in [`client/src/main.tsx`](client/src/main.tsx): `tokens.css` → `index.css` → `tournament-girls.css` → `tournament-worldcup.css`.
- Layout/utilities (`.app`, `.card`, `.btn-primary`, `.loading`) live in [`client/src/App.css`](client/src/App.css) (no `:root` there).
- Girls theme overrides `--color-*` primitives under `[data-tournament="girls"]` so shared components (tables, `.btn-theme-green`, header) repaint without duplicate rules.
- Profile: girls registration card only uses `.registration-card--girls` ([`TournamentRegistrationCard.css`](client/src/components/profile/TournamentRegistrationCard.css)); Profile shell stays boys-green.
- New UI tokens: `.tournament-page-title`, `.tournament-badge`, `.btn-tournament-primary`, `.text-tournament-primary` — prefer these over Bootstrap `text-success` on girls pages.

## Accessibility (Israeli Standard IS 5568)

**All UI and frontend changes must comply with Israeli Standard ת"י 5568 (WCAG 2.1 Level AA).** This is a legal requirement in Israel, not optional polish.

| Resource | Purpose |
|----------|---------|
| [.cursor/rules/israeli-accessibility-is5568.mdc](.cursor/rules/israeli-accessibility-is5568.mdc) | Persistent rule for Cursor agents editing `client/**` |
| [Review/is-5568-wcag-aa-pass-may-2026.md](Review/is-5568-wcag-aa-pass-may-2026.md) | May 2026 review (mostly resolved; coordinator contact still open) |
| [status.md](status.md) | Checklist and completion status |
| [client/src/pages/Accessibility.tsx](client/src/pages/Accessibility.tsx) | Public accessibility statement (נגישות) |

When fixing or adding UI: use native buttons/links, labels, focus, keyboard, contrast, Hebrew `lang`, and keep `/accessibility` accurate (real coordinator contact before production).

## Agent continuity

**Start here for implementation handoff:** [.cursor/agent-rtm.md](.cursor/agent-rtm.md) (req→file map, open gaps, smoke commands). Formal stakeholder RTM: `Review/phase-1.5-rtm-qa-may-2026.md` (may lag code).

## Current Focus
- **Phase 2 (May 2026):** Tournament registration via `RegistrationService` — `season_registrations`, `invoice_codes` (admin assign + user redeem, Redis rate limit), `team_*_requests`, `active_division`, owner join review. APIs: `/api/users/registration`, `/api/users/redeem-invoice`, `/api/teams/creation-request`, `/:id/join-request`, admin `/api/admin/workflows`. UI: Profile invoice cards, Admin → סגל ורישום → `RegistrationWorkflowAdmin`, Teams join button.
- **Phase 1.5:** Girls read/write scaffold; division-scoped news/teams/archive.
- **Legacy (shrinking):** `mappedPlayerInfo` / Captain still in old admin mapping UI; `/users/map-player` returns 410; roster hydration merges Prisma `players` into `/auth/me`.
- **Deploy:** Push API + client for Phase 2; ensure `REDIS_URL` on Render for invoice lockout.

## Recent Changes
- **June 2026 — Security hardening:** httpOnly JWT cookies (`rt_session`, `rt_player`); Origin CSRF guard; auth rate limits; lazy admin bundle; Vercel security headers; `/player-zone` noindex; AES-256-GCM `personal_id` encryption; admin role guard.
- **June 2026 — World Cup UI polish:** Tournament-aware footer/legal chrome (`siteHomePath`, `siteBrandLabel`); WC a11y/UX fixes (Hebrew labels, filter `aria-pressed`, empty states, schedule `matchId` scroll, bracket on stats only). Reversion unchanged — see [review/world-cup-phase.md](review/world-cup-phase.md).
- **May 2026 — Girls UI theme:** Dreamy pink/lavender scoped theme via `data-tournament="girls"`; girls routes + Profile girls registration card.
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
