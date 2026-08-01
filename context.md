# Project Context: Ramadan Tournament

Hebrew RTL tournament site for כפר כמא / summer 2026 (boys football, girls points, optional FIFA WC proxy).

## Tech stack

- **Client:** React 19, Vite 7, TypeScript, Bootstrap 5, PWA, `react-helmet-async`
- **Server:** Node/Express, PostgreSQL (Prisma), Redis (ioredis), TypeScript
- **Shared:** `@ramadan-tournament/shared` (ID/birth-year, match timing, empty display, etc.)
- **Host:** Render (API + Postgres + Redis), Vercel (client)
- **Peripheral Python:** `scripts/` (photo sync, Postgres backup, alarms, analytics dashboard) via repo `.venv` + `scripts/requirements.txt`

## Architecture

- Monorepo: `client/`, `server/`, `shared/`, `data/`, `docs/`, `.incoming/`
- Seasons by `division` (boys/girls). Redis `rt:` caches; `TeamDataService` ~120s; `saveTeam` invalidates `rt:doc:{division}:*`
- Registration: `RegistrationQueryService` / `RegistrationWorkflowService` / `RegistrationIdentityService`; roster via `TeamRosterService` + soft-delete `PlayerService.deactivateRosterMember`
- Bootstrap: `db:migrate` + `db:seed`; clean start `db:fresh` (not seed for live schedules)
- Tests: Vitest `shared/` + `server/`; root `npm run test`; CI `.github/workflows/test.yml`
- Docs: [`docs/README.md`](docs/README.md); handoff [`.cursor/agent-rtm.md`](.cursor/agent-rtm.md) → [`docs/agent/HANDOFF.md`](docs/agent/HANDOFF.md)

## Environment

| Variable | Where | Notes |
|----------|--------|--------|
| `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ADMIN_*` | Render | Required API |
| `PERSONAL_ID_KEY` | Render | AES-256-GCM; set `PERSONAL_ID_MIGRATION_DONE=1` after migrate |
| `UPLOADS_DISK_PATH` | Render | e.g. `/var/data/uploads`; prod 503 if unset |
| `COOKIE_SAME_SITE` | Render | `lax` when Vercel proxies `/api` |
| `SITE_PUBLIC_URL` | Render | Password-reset links |
| `CORS_ORIGINS` | Render | Omit for defaults, or list **every** live origin |
| `VITE_API_SAME_ORIGIN` | Vercel | `true` → relative `/api` rewrite to Render |
| `VITE_SITE_URL` | Vercel | Canonical SEO (no trailing slash) |
| `VITE_WORLD_CUP_ENABLED`, `VITE_DUAL_TOURNAMENT` | Vercel | WC switcher; dual keeps boys+girls+WC |
| `WORLD_CUP_ENABLED`, `FOOTBALL_DATA_API_KEY` | Render | Optional WC proxy |
| `ANALYTICS_RETENTION_DAYS` | Render | Default 90 |

Local: `server/.env` + `client/.env` only (no repo-root `.env`). Mock without Postgres: `npm run dev:mock`.

**Uploads:** Prefer non-empty `server/uploads` (git sync); new writes to disk until sync. Sharp compress (short edge ≤1080; banners 4:1 max 1080×270 PNG). Confirm Render disk mount in dashboard.

**Auth:** Vercel rewrites `/api` + `/uploads` → Render; Bearer `sessionStorage` fallback for Safari/IG. Diagnostics may fire without cookie consent.

## Client shell

- App routes: header + news + sidebar + footer. Legal: `LegalPageLayout` (prerendered). `/rules` boys only in sidebar legal/footer.
- **Mobile ≤768px:** bottom nav (Home → Teams → Schedule → Stats → Profile); header = switcher \| title \| hamburger; drawer overflow. Active tab: tint pill + underline. `dir` from device lang (`en*` → LTR).
- Verify mobile on **Safari first**, then Chrome, then Instagram WebView ([`.cursor/rules/mobile-safari-instagram.mdc`](.cursor/rules/mobile-safari-instagram.mdc)).
- Themes: `data-tournament` boys (green/yellow `tokens.css`) / girls (`tournament-girls.css`) / worldcup (`tournament-worldcup.css`).
- Browse: 2px status border + tint ([`neo-brutal-browse.css`](client/src/styles/neo-brutal-browse.css)); no spectator L-frame. Teams: accordion browse + dense roster.
- Match expand: fabricated stats + win-chance (upcoming bar always; comments on boys). Share: 1080×1920 PNG via `ShareButton` (dashboard lists, match cards, teams, playoff bracket).
- Skeletons immediate on public fetch ([`useMinSkeletonTime`](client/src/hooks/useMinSkeletonTime.ts)); `PageLoading` for Suspense/admin only.
- Product copy: no em dashes (`—`); empty cells ASCII `-` via `displayOrDash` ([`.cursor/rules/no-em-dashes-product-copy.mdc`](.cursor/rules/no-em-dashes-product-copy.mdc)).
- Engagement: donation popup Fri/Sat ≥17:00 Jerusalem; albums tip Sun–Thu; stats tip Fri/Sat (`EngagementNudgeHost`).
- Live poll cadence: `TOURNAMENT_POLL_INTERVAL_MS` (2 min). Circassian: Fri/Sat 17:00–20:00 Jerusalem when a match is that day (`shouldPollTournamentData`). World Cup: while LIVE/IN_PLAY. Status badges + live match-stats expand: same interval.

## Accessibility

IS 5568 / WCAG 2.1 AA required for `client/**`. Rule: [`.cursor/rules/israeli-accessibility-is5568.mdc`](.cursor/rules/israeli-accessibility-is5568.mdc). Statement: `/accessibility`.

## Design / agent continuity

- [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md) — tokens, themes, regretted experiments
- Knockout match cards: inline `.playoff-badge` in `.match-card-badges` (not absolute float). Bracket titles use Roboto; do not load Outfit for Hebrew.
- code-review-graph: tool venv under `code-review-graph` repo; DB `.code-review-graph/` (gitignored)

## Current focus

- Phase 2 registration (encrypted personal ID + birth year, join/create/transfer, owner/captain review) — deploy + PO QA
- Phase 1.5 girls scaffold (archive UI still placeholder; history in `archive/postgres/` CI)
- Playoffs / banners / uploads disk: see open items in [`status.md`](status.md)

## Fresh tournament start

1. `npm run db:fresh` (remote needs `--yes`)
2. Promote admins (UI משתמשים; re-login)
3. Identity on Profile → join/create workflows
4. `npm run fixtures:generate -- --start-date …` (Fri/Sat, times, `--replace` / `--yes` as needed) — not `db:seed` for prod schedules
5. Admin edit kickoffs; update [`shared/local-team-crest-map.json`](shared/local-team-crest-map.json) if season UUID changed

**Playoff sync:** Admin **סנכרן פלייאוף**. Semis Sat 01/08/2026 (17:00 lower / 18:00 upper, צפוני+דרומי); finals Sat 08/08 (17:30 / 18:30 צפוני). No fake finalists; lock teams after kickoff or `shouldCountMatchInStats`.

**Team banners:** Upload overrides [`teamBanners.ts`](client/src/config/teamBanners.ts) fallbacks (ids 1/3/7).
