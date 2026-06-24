# Agent RTM (continuity only)

**For:** next Cursor agent on this repo. **Not** product sign-off — see `review/phase-2-rtm-qa-may-2026.md` (Phase 2) and `review/phase-1.5-rtm-qa-may-2026.md` (Phase 1.5 only).

**PRD:** `.incoming/PRD-database-schema.md` v0.9  
**Last code review:** 2026-05-18  
**Handoff reads:** this file → `context.md` → `status.md` (status may over-claim; trust code + this file)

---

## Quick verdict

| Slice | State | Notes |
|-------|--------|--------|
| P1 Postgres + boys seed | **Done** | Do not re-seed prod without intent |
| P1.5 girls read + admin points | **Mostly done** | No girls in seed; admin must create girls season |
| P1.5 gaps | **Open** | `GirlsArchive.tsx` placeholder; shared layout; global admin season picker |
| P2 registration / invoice | **In code, not QA'd** | `RegistrationService`, routes, Profile + Admin UI exist |
| P2 gaps | **Open** | Legacy `mappedPlayerInfo` parallel; `personal_id` encrypt on writes; PO manual QA P2-T* |
| Session fixes | **Done** | Vote modal guard `Teams.tsx`; switcher z-index |

---

## Req → file map (where to work)

| If task is… | Start here |
|-------------|------------|
| Division routing | `server/src/middleware/tournamentDivision.ts`, `SeasonService.ts` |
| Boys/girls API mount | `server/src/index.ts` (`*-girls` routers) |
| News per division | `NewsDataService.ts`, `newsController.ts`, `client/src/api/client.ts` `newsAPI(slug)` |
| Teams per division | `TeamDataService.ts`, `teamController.ts`, `teamsAPI(slug)` |
| Archive | `archiveController.ts` `?division=`, `GirlsArchive.tsx` (stub) |
| Girls standings | `PointsStatsService.ts`, `pages/girls/*` |
| Girls admin | `GirlsSeasonAdmin.tsx`, `AdminSeasonService.ts` |
| Invoice + lockout | `RegistrationService.ts`, `InvoiceRateLimitService.ts`, `registrationController.ts` |
| Join/create/transfer | `RegistrationService.ts`, `server/src/routes/teams.ts`, `users.ts`, `admin.ts` |
| Owner join approve UI | `TeamRegistrationActions.tsx` on `Teams.tsx`, `girls/GirlsTeams.tsx` |
| Profile registration UI | `TournamentRegistrationCard.tsx`, `Profile.tsx` |
| Admin workflow queues | `RegistrationWorkflowAdmin.tsx`, Roster tab in `AdminPanel.tsx` |
| Cross-division lock | `RegistrationService.lockActiveDivision` / `assertDivisionAccess` |
| Legacy roster (retire) | `mappedPlayerInfo` in `Profile.tsx`, `AuthContext.tsx`, `RosterManager.tsx`, `Dashboard.tsx` |
| MVP votes | `voteController.ts` — still `playerMemberId` only; PRD girls = `team_id` |
| Schema / seed | `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seed-empty.ts` |
| Fresh season + fixtures | `npm run db:fresh`, `src/scripts/generate-group-fixtures.ts` — see `context.md` § Fresh tournament start |
| Admin user roles | `AdminUserService.ts`, `GET/PATCH /api/admin/users`, AdminPanel tab **משתמשים** |

---

## Gaps (agent backlog)

1. **Girls archive UI** — wire `GirlsArchive.tsx` to `GET /api/archive?division=girls`.
2. **Retire `mappedPlayerInfo`** — single path via `GET /users/registration` + roster from Prisma players.
3. ~~**Girls team MVP**~~ — `POST /api/votes-girls`, `GirlsTeams.tsx` team star vote (May 2026).
4. **`personal_id`** — confirm encrypt on create/update (column `personalIdEnc` exists).
5. **Manual QA P2** — invoice redeem, join owner→admin, cross-division error (Hebrew), 5 wrong codes lockout.
6. **Optional cleanup** — dead Mongo/Iftar files still excluded from `tsc`, not deleted.

---

## Smoke (agent can run)

```powershell
# API build
cd server; npm run build

# Health (prod or local)
curl.exe -s https://ramadan-tournament-api.onrender.com/api/health

# Local full stack needs server/.env DATABASE_URL (Render external + IP allowlist)
# UI-only: client/.env VITE_API_URL → prod API, npm run dev in client
```

**Do not** run `db:seed` or `db:fresh` on production unless wiping is intended. Remote DB requires `--yes`.

```powershell
# Fresh season (local)
cd server; npm run db:fresh

# Preview fixtures (needs 2+ active teams)
npm run fixtures:generate -- --start-date 2026-07-01 --dry-run
```

---

## Doc drift (ignore confusion)

| Source | Drift |
|--------|--------|
| `review/phase-1.5-rtm-qa-may-2026.md` | §3.4 superseded — use `review/phase-2-rtm-qa-may-2026.md` for Phase 2 |
| `status.md` | May say Phase 2 **done** — means implemented, not QA signed off |
| **This file** | Code-truth for agents |

---

## QA I did not run

T5–T8 in formal RTM (invoice, join workflow, cross-division). Mark **Not run** until someone executes in prod/staging.
