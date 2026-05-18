# Requirements Traceability Matrix & QA Report

**Project:** Ramadan Tournament (Postgres + Redis rebuild)  
**PRD source:** [`.incoming/PRD-database-schema.md`](../.incoming/PRD-database-schema.md) v0.9  
**Report date:** 2026-05-18  
**Author:** Implementation agent (Cursor session)  
**Scope:** Work through May 2026 — Phase 1.5 alignment, session bug fixes, and explicit **non-delivery** of Phase 2 (§16).

---

## 1. Executive summary

| Area | Verdict |
|------|---------|
| **Database / Phase 1 schema** | Largely aligned (~90%); tables exist including Phase 2 tables without product APIs |
| **Phase 1.5 — §15 dual tournament UX** | **Partial** — public read path + switcher + girls admin (points) strong; writes/archive/news gaps **addressed in code** May 2026; girls archive UI still placeholder |
| **Phase 2 — §16 registration / invoice** | **Not implemented** this session (no routes, no UI, legacy `mappedPlayerInfo` still in use) |
| **Session QA (bugs)** | Vote modal null guard, tournament switcher z-index — fixed in client |

**Bottom line:** Foundation and boys football product match the PRD. Girls is a **read scaffold + partial admin** with **division-aware writes** for news, team mutations, and archive queries added May 2026. Registration, invoice, and `season_registrations` remain Phase 2.

---

## 2. Traceability legend

| Status | Meaning |
|--------|---------|
| **Met** | Requirement implemented and traceable in code |
| **Partial** | Implemented with known gaps vs PRD |
| **Not Met** | Required but missing |
| **N/A** | Out of scope or explicitly deferred in PRD |
| **Not Tested** | Code present; no automated or manual QA run recorded in this report |

| Test | Meaning |
|------|---------|
| **Code review** | Verified by reading implementation / `tsc --noEmit` |
| **Manual pending** | Requires deploy or local smoke test |
| **Not run** | No verification performed |

---

## 3. Requirements Traceability Matrix

### 3.1 Infrastructure & Phase 1 (schema / boys football)

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| INF-01 | §5, §11 | PostgreSQL schema with `seasons`, `teams`, `players`, football tables | `server/prisma/schema.prisma` | Met | Code review |
| INF-02 | §2, §11 | Iftar removed from product/API | No Iftar routes in `server/src/index.ts` | Met | Code review |
| INF-03 | §9 | Redis cache for hot reads | `server/src/services/CacheService.ts`, `REDIS_URL` | Met | Code review |
| INF-04 | §10 | Seed boys football from `data/*.json` | `server/prisma/seed.ts` | Met | Code review (prod seed noted in `status.md`) |
| INF-05 | §5 | `point_entries`, `invoice_codes`, `season_registrations` tables exist | `schema.prisma` | Met (schema only) | Code review |
| INF-06 | §6.H | `personal_id` encrypted at rest on write | Column `personalIdEnc`; import paths still use plain strings | Partial | Not run |
| BOYS-01 | §15 | Boys read APIs unchanged (`/api/teams`, `/matches`, `/stats`) | `server/src/index.ts`, controllers | Met | Manual pending |
| BOYS-02 | §15 | Boys client routes unchanged (`/`, `/teams`, …) | `client/src/App.tsx` | Met | Manual pending |

### 3.2 Phase 1.5 — §15 Dual tournament UX

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P15-01 | §15 URL | Girls routes: `/girls`, `/teams-girls`, `/news-girls`, `/archive-girls` | `client/src/App.tsx`, `client/src/pages/girls/*` | Met | Manual pending |
| P15-02 | §15 URL | Boys paths unchanged | `client/src/App.tsx` | Met | Code review |
| P15-03 | §15 API | `/api/teams-girls`, `/api/news-girls`, `/api/stats-girls` + `setGirlsDivision` | `server/src/index.ts`, `middleware/tournamentDivision.ts` | Met | Manual pending (deploy) |
| P15-04 | §15 API | `GET /api/seasons/active?division=boys\|girls` | `server/src/routes/seasons.ts`, `SeasonService` | Met | Manual pending |
| P15-05 | §15 | `TournamentContext` + slug from URL | `client/src/contexts/TournamentContext.tsx` | Met | Code review |
| P15-06 | §15 | Tournament switcher in header | `client/src/components/TournamentSwitcher.tsx` | Met | Manual pending |
| P15-07 | §15 | `localStorage` `preferredTournament` | `TournamentContext.tsx`, redirect helper | Met | Not run |
| P15-08 | §15 | Separate nav for boys vs girls (no schedule/MVP on girls) | `client/src/components/TournamentNavbar.tsx` | Partial | Code review |
| P15-09 | §15 | Separate layouts / branding per branch | Single `App.tsx` shell, shared header title | Partial | Code review |
| P15-10 | §15 | News scoped per season on **read** | `NewsDataService.getAllNews(division)`, `NewsBanner` uses `slug` | Met | Manual pending |
| P15-11 | §15 | News **admin write** scoped per division | `NewsDataService` CRUD + `/api/news-girls` + Admin division selector | **Met (May 2026)** | Manual pending |
| P15-12 | §15 | Team **read** scoped per division | `TeamDataService.getTeamsDocument(division)` | Met | Manual pending |
| P15-13 | §15 | Team **write** scoped per division | `Team.findOne(..., division)`, `teamController` + `teamsAPI` slug paths | **Met (May 2026)** | Manual pending |
| P15-14 | §15 | Archive `@@unique([yearMonth, division])` on **read** | `GET /api/archive?division=`, `GET /api/archive/:yearMonth?division=` | **Met (May 2026)** | Manual pending |
| P15-15 | §15 | Girls archive page (when exists) | `GirlsArchive.tsx` — static placeholder | Not Met | N/A UI |
| P15-16 | §15 Admin | Girls season create/activate, teams, point entries | `GirlsSeasonAdmin.tsx`, `AdminSeasonService`, admin routes | Met | Manual pending |
| P15-17 | §15 Admin | Season selector for news (boys/girls) | `AdminPanel.tsx` `newsDivision` select | **Partial** (news only; not global admin season) | Manual pending |
| P15-18 | §15 Admin | No match editor on girls season | Matches tab still global football | Partial | Code review |
| P15-19 | §2 | No girls season in seed (manual admin) | `seed.ts` boys only | Met (by design) | Code review |
| P15-20 | §15 Redis | Cache keys scoped by division | `CacheService.key('doc', division, ...)` | Met | Code review |

### 3.3 Audit remediation (May 2026 — same session as RTM)

| Req ID | Source | Requirement | Evidence | Status | Test |
|--------|--------|-------------|----------|--------|------|
| AUD-01 | Audit #1 | Admin news create/update/delete target correct season | `newsController.ts`, `NewsDataService.ts`, `client.ts` `newsAPI`, `AdminPanel.tsx` | Met | Code review |
| AUD-02 | Audit #2 | Captain/roster writes use girls season on `-girls` API | `Team.ts` division param, `teamController.ts`, `teamsAPI` | Met | Manual pending |
| AUD-03 | Audit #3 | Archive queries include `division` | `server/src/routes/archive.ts`, `archiveAPI` | Met | Manual pending |
| AUD-04 | Audit | `status.md` reflects Phase 1.5 in progress | `status.md`, `context.md` | Met | Code review |

### 3.4 Phase 2 — §16 Registration & invoice (explicitly not done)

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-01 | §16 | Layer 1 website registration (OAuth/OTP) | `auth` routes, `Login.tsx` | Met (pre-existing, not Phase 2 rebuild) | Not run |
| P16-02 | §16 | Layer 2 `season_registrations` status machine | Table in schema; **no API** | Not Met | — |
| P16-03 | §16 | Invoice assign + redeem on profile | `invoice_codes` table; **no routes** | Not Met | — |
| P16-04 | §16 | Redis invoice wrong-attempt lockout | Not implemented | Not Met | — |
| P16-05 | §16 | Join/create team via PRD request tables | Legacy `mappedPlayerInfo`, `User` model | Not Met | — |
| P16-06 | §6.B | `active_division` set and enforced on join | Column exists; **not checked** on join | Not Met | — |
| P16-07 | §6.B | One person not in boys and girls same year | Not enforced in app layer | Not Met | — |
| P16-08 | §16 Admin | Invoice assignment queue UI | Not present | Not Met | — |
| P16-09 | §6 | Retire Captain/Player legacy roles per PRD | Still used (`Captain`, `mappedPlayerInfo`) | Not Met | — |
| P16-10 | §6.G | Girls MVP = team vote (`votes.team_id`) | `Vote` model football/player only | Not Met | — |

### 3.5 Session bug fixes (UX / stability — not PRD features)

| Req ID | Description | Evidence | Status | Test |
|--------|-------------|----------|--------|------|
| FIX-01 | Vote modal: no crash when `voteConfirmPlayer` null | `client/src/pages/Teams.tsx` null guard + `confirmVote` local copy | Met | Manual pending |
| FIX-02 | Tournament switcher dropdown not hidden under news banner | `index.css`, `TournamentSwitcher.css` z-index/overflow | Met | Manual pending |

---

## 4. QA test summary

### 4.1 Automated checks

| Check | Result | Notes |
|-------|--------|-------|
| `server`: `npx tsc --noEmit` | **Pass** | After `Team.find` signature fix in `userController.ts` |
| `client`: `tsc` / build | **Not run** in this report | Recommend `npm run build` in `client/` |
| Playwright / E2E | **Not available** | Package not in project |

### 4.2 Recommended manual test plan

| # | Scenario | Steps | Expected | Priority |
|---|----------|-------|----------|----------|
| T1 | Boys teams page | Open `/teams`, expand team, vote | No console error; modal works | P0 |
| T2 | Switcher layering | Open tournament switcher on home | Dropdown fully visible above news banner | P1 |
| T3 | Admin news boys | Admin → חדשות → בנים → create/edit/delete | Items appear on boys banner only | P0 |
| T4 | Admin news girls | Select בנות (active girls season required) → CRUD | Items on `/news-girls` / girls banner only | P0 |
| T5 | Girls teams read | `/teams-girls` with active girls season | Teams list; no football-only fields broken | P1 |
| T6 | Archive division | `GET /api/archive?division=boys` vs `girls` | Distinct lists when both exist | P2 |
| T7 | Production API | Hit Render `/api/teams-girls` | 200 (not 404) after deploy | P0 |

### 4.3 Defects / risks logged

| ID | Severity | Description | Mitigation |
|----|----------|-------------|------------|
| R-01 | High | Phase 2 flows still use `mappedPlayerInfo` — PRD mismatch | Plan Phase 2 sprint |
| R-02 | Medium | Profile/Captain client still calls `/teams/*` (boys) only | OK for football; document until girls captains exist |
| R-03 | Medium | Render may lack latest `*-girls` routes until deploy | Deploy API + client |
| R-04 | Low | `News` mongoose adapter still football-scoped if called elsewhere | Prefer `NewsDataService` for new code |
| R-05 | Low | Girls archive UI placeholder | Implement when girls archives exist |

---

## 5. File change index (May 2026 alignment work)

| File | Change type |
|------|-------------|
| `server/src/services/NewsDataService.ts` | Division-aware CRUD + cache invalidation |
| `server/src/controllers/newsController.ts` | Uses `NewsDataService` + `getRequestDivision` |
| `server/src/models/Team.ts` | `Division` on find/findOne/loadTeams |
| `server/src/controllers/teamController.ts` | `requestDivision(req)` on mutations |
| `server/src/routes/archive.ts` | `division` query param |
| `server/src/models/SeasonArchive.ts` | `create()` accepts division |
| `client/src/api/client.ts` | `newsAPI`, `teamsAPI`, `archiveAPI` slug-aware |
| `client/src/pages/admin/AdminPanel.tsx` | News division selector + API slug |
| `client/src/pages/Teams.tsx` | Vote modal null safety |
| `client/src/index.css`, `client/src/components/TournamentSwitcher.css` | Switcher stacking |
| `status.md`, `context.md` | Honest phase status + scorecard |

---

## 6. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Implementer | Agent | 2026-05-18 | Code review + server `tsc` only |
| Product owner | _Pending_ | | Manual T1–T7 recommended |
| QA | _Pending_ | | No formal test execution recorded |

---

## 7. Related documents

- [PRD-database-schema.md](../.incoming/PRD-database-schema.md)
- [status.md](../status.md) — live checklist
- [context.md](../context.md) — architecture snapshot
- [is-5568-wcag-aa-pass-may-2026.md](is-5568-wcag-aa-pass-may-2026.md) — accessibility (separate from this RTM)
