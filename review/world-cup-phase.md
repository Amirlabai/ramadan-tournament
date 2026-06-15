# World Cup Phase — Implementation & Reversion Guide

Temporary read-only integration with [football-data.org](https://www.football-data.org/) v4 for FIFA World Cup 2026 (`WC`). Local Ramadan tournament data in PostgreSQL is never modified.

**Last updated:** 2026-06-15

### UI polish (2026-06-15)

- Footer and legal chrome use `siteHomePath()` / `siteBrandLabel()` from `tournamentPaths.ts` (respects `VITE_WORLD_CUP_ONLY`).
- World Cup pages: Hebrew live label, filter `aria-pressed`, empty states, heading hierarchy (`h3` sections), bracket only on stats, schedule deep-link by `matchId`.
- `AppShell` sets `theme-color` meta per tournament; WC header logo alt text.
- Boys `Schedule` / `Teams`: loading `role="status"`, filter `aria-pressed`, login confirm via `AccessibleModal` (no `window.confirm`).

---

## 1. Purpose and timeline

- Third tournament branch at `/world-cup/*`, selectable from the tournament switcher.
- Data source: football-data.org competition `WC`, season `2026`.
- Disabled features: match comments, MVP voting, admin match CRUD, team registration, archive.

---

## 2. Activation checklist

### Render (API)

| Variable | Value |
|----------|--------|
| `WORLD_CUP_ENABLED` | `true` |
| `WORLD_CUP_ONLY` | `true` — **WC-only API**: skips Postgres/Redis/JWT at startup; only `/api/worldcup/*` + `/api/health` |
| `FOOTBALL_DATA_API_KEY` | Your token from [football-data.org](https://www.football-data.org/client/register) dashboard |
| `FOOTBALL_DATA_COMPETITION` | `WC` (optional, default) |
| `FOOTBALL_DATA_SEASON` | `2026` (optional, default) |

With `WORLD_CUP_ONLY=true` or no `DATABASE_URL`, startup skips Postgres. If `DATABASE_URL` points at a dead DB but `WORLD_CUP_ENABLED=true`, the server falls back to WC-only routes after connect fails.

Full tournament API (boys/girls + WC): set `WORLD_CUP_ENABLED=true` only — Postgres and Redis still required.

### Vercel (client)

| Variable | Value |
|----------|--------|
| `VITE_WORLD_CUP_ENABLED` | `true` |
| `VITE_WORLD_CUP_ONLY` | `true` (hides local tournament; redirects `/` → `/world-cup`) |

Redeploy both services after setting variables.

### Local development

```env
# server/.env
WORLD_CUP_ENABLED=true
FOOTBALL_DATA_API_KEY=your_token_here
```

Without an API key, the server serves static snapshots from `data/worldcup/*.json`.

---

## 3. File inventory

### New files

| File | Purpose |
|------|---------|
| `server/src/services/WorldCupNormalizer.ts` | Maps football-data.org JSON → app DTOs |
| `server/src/services/FootballDataService.ts` | HTTP client, Redis cache, JSON fallback |
| `server/src/controllers/worldcupController.ts` | Express handlers for `/api/worldcup/*` |
| `server/src/routes/worldcup.ts` | Route definitions |
| `data/worldcup/meta.json` | Mock competition metadata |
| `data/worldcup/matches.json` | Mock matches (FD shape) |
| `data/worldcup/standings.json` | Mock group standings |
| `data/worldcup/scorers.json` | Mock top scorers |
| `data/worldcup/teams.json` | Mock national teams + squads |
| `data/worldcup/hebrew-locale.json` | English → Hebrew map (teams, players, venues, positions, stages, groups) |
| `server/src/utils/worldCupLocale.ts` | Loads locale JSON; used by `WorldCupNormalizer` |
| `client/src/utils/worldCupLocale.ts` | Client labels for groups/stages (imports same JSON) |
| `client/src/pages/worldcup/WorldCupDashboard.tsx` | WC home |
| `client/src/pages/worldcup/WorldCupSchedule.tsx` | WC schedule |
| `client/src/pages/worldcup/WorldCupStats.tsx` | WC standings + bracket + scorers |
| `client/src/pages/worldcup/WorldCupTeams.tsx` | WC national squads |
| `client/src/components/WorldCupBracket.tsx` | Knockout bracket by stage |
| `client/src/styles/tournament-worldcup.css` | WC theme (`data-tournament="worldcup"`) |
| `client/src/utils/worldCupEnabled.ts` | `VITE_WORLD_CUP_ENABLED` + `VITE_WORLD_CUP_ONLY` flags and route redirects |
| `Review/world-cup-phase.md` | This document |

### Shared UI helpers (tournament-aware, revert-safe)

| File | Purpose |
|------|---------|
| `client/src/utils/tournamentPaths.ts` | `siteHomePath()`, `siteBrandLabel()` — legal chrome + `VITE_WORLD_CUP_ONLY` home when flags off |

These helpers read the same env flags as the WC phase; disabling WC (section 6) restores boys/girls branding without deleting files.

### Modified files

| File | Change |
|------|--------|
| `server/src/config/env.ts` | `WORLD_CUP_*` env vars |
| `server/src/index.ts` | Register `/api/worldcup` when enabled |
| `server/src/mock/registerMockRoutes.ts` | WC routes in mock dev mode |
| `client/src/types/index.ts` | `Goal.playerName`, `Match.status/stage/group`, `GroupStanding` |
| `client/src/utils/tournamentPaths.ts` | `worldcup` slug and paths; `siteHomePath` / `siteBrandLabel` |
| `client/src/contexts/TournamentContext.tsx` | WC season meta, `isWorldCup` |
| `client/src/components/Footer.tsx` | Tournament-aware footer links |
| `client/src/components/LegalPageLayout.tsx` | `siteHomePath` / `siteBrandLabel` for legal chrome |
| `client/src/components/TournamentSwitcher.tsx` | Keyboard listbox (Escape, arrows) |
| `client/src/utils/mainNavItems.ts` | WC navigation items |
| `client/src/api/client.ts` | `worldcupAPI` |
| `client/src/App.tsx` | WC routes, `data-tournament` attribute |
| `client/src/main.tsx` | Import WC CSS |
| `client/src/config/seoConfig.ts` | WC route SEO + sitemap paths |
| `client/scripts/generate-sitemap.mjs` | WC paths when env flag set |
| `context.md` | World Cup phase pointer |
| `status.md` | World Cup phase checklist |

---

## 4. API mapping reference

### football-data.org → app DTOs

| Local field | Source (FD match) |
|-------------|-------------------|
| `id` | `id` |
| `date` | `utcDate` |
| `location` | `venue` |
| `phase` | `GROUP_STAGE` → `group`; else `knockout` |
| `team1Id` / `team2Id` | `homeTeam.id` / `awayTeam.id` |
| `team1Name` / `team2Name` | `homeTeam.name` / `awayTeam.name` |
| `team1LogoUrl` / `team2LogoUrl` | `homeTeam.crest` / `awayTeam.crest` |
| `score1` / `score2` | `score.fullTime.home` / `away` |
| `goals[]` | `goals[]` → `{ memberId: scorer.id, minute, playerName }` |
| `status` | `status` |
| `stage`, `group` | `stage`, `group` |

| Standing field | Source (FD table row) |
|----------------|----------------------|
| `teamId` | `team.id` |
| `teamName` | `team.name` |
| `played` | `playedGames` |
| `won` / `drawn` / `lost` | `won` / `draw` / `lost` |
| `goalsFor` / `goalsAgainst` | `goalsFor` / `goalsAgainst` |
| `goalDifference` | `goalDifference` |
| `points` | `points` |
| `group` | parent standings `group` |

### Server routes

| Route | Response |
|-------|----------|
| `GET /api/worldcup/meta` | Competition + season summary |
| `GET /api/worldcup/matches` | `Match[]` |
| `GET /api/worldcup/teams` | `Team[]` |
| `GET /api/worldcup/stats/standings` | `GroupStanding[]` |
| `GET /api/worldcup/stats/top-scorers` | `TopScorer[]` |
| `GET /api/worldcup/stats/dashboard` | `DashboardData` |
| `GET /api/worldcup/stats/knockout` | Knockout `Match[]` |

---

## 5. Runtime behavior

- **Caching:** Redis keys `rt:wc:{resource}:{season}`; TTL 60s when live matches exist, else 120s.
- **Polling:** WC pages poll every 30s when any match is `LIVE` or `IN_PLAY`.
- **Fallback:** If FD API fails, serve stale Redis cache; else read `data/worldcup/*.json`.
- **Disabled:** Comments, MVP, admin matches, registration, archive on WC routes.

### Hebrew display (`hebrew-locale.json`)

API text from football-data.org is English. `WorldCupNormalizer` applies `server/src/utils/worldCupLocale.ts` before responses leave the server:

| JSON section | Keys | Example |
|--------------|------|---------|
| `teamNames` | English team name | `"Brazil"` → `"ברזיל"` |
| `teams` | football-data team id | `"764"` → `"ברזיל"` |
| `playerNames` / `players` | Name or player id | `"Lionel Messi"` → `"ליאונל מסי"` |
| `venues` | Stadium name | `"MetLife Stadium"` → `"אצטדיון מטלייף"` |
| `positions` | Squad role | `"Goalkeeper"` → `"שוער"` |
| `stages` / `groups` | Knockout stage / group code | `"SEMI_FINALS"` → `"חצי גמר"` |

Lookup order: English name first, then id. Unmapped names pass through unchanged — extend the JSON as squads and scorers grow.

Regenerate full squad map from football-data.org:

```bash
cd server
FOOTBALL_DATA_API_KEY=your_token npx tsx scripts/buildWorldCupPlayerLocale.ts
```

Manual fixes for famous players: `data/worldcup/player-overrides.json` (preserved on rebuild). Runtime fallback: phonetic transliteration in `latinToHebrew.ts` for any name still missing.

---

## 6. Reversion procedure

1. Set `WORLD_CUP_ENABLED=false` on Render; redeploy API.
2. Set `VITE_WORLD_CUP_ENABLED=false` and `VITE_WORLD_CUP_ONLY=false` on Vercel; redeploy client.
3. Remove `WORLD_CUP_ONLY` from Render (or set `false`); restore `DATABASE_URL` / `REDIS_URL` if pausing WC-only mode.
4. Verify boys routes (`/`, `/schedule`, `/stats`) unchanged and switcher shows only boys + girls.
5. Optional cleanup — delete new files listed in section 3 (new files only).
6. No database migration or re-seed required for WC removal (WC never wrote to Postgres).

---

## 7. Known limitations

- Team names are in English from the API.
- Crest URLs may be null on free tier.
- WC 2026 squads may be incomplete until closer to kickoff.
- No match comments or MVP voting (local DB only).
- No admin match editing for WC data.

---

## 8. Attribution

Match, standings, scorer, and team data provided by [football-data.org](https://www.football-data.org/). Use must comply with their terms of service.
