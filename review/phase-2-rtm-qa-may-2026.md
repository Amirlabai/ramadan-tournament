# Requirements Traceability Matrix & QA Report — Phase 2

**Project:** Ramadan Tournament (Postgres + Redis rebuild)  
**PRD source:** [`.incoming/PRD-database-schema.md`](../.incoming/PRD-database-schema.md) v0.9 (§16, §6.B–E)  
**Plan source:** Player registration workflows (Phase 2), Postgres migration plan (schema reservation)  
**Report date:** 2026-05-18  
**Scope:** Phase 2 — invoice gate, `season_registrations`, team create/join/transfer, owner APIs, admin queues, Profile UI  
**Prior report:** [phase-1.5-rtm-qa-may-2026.md](phase-1.5-rtm-qa-may-2026.md) (Phase 1.5; Phase 2 was “Not Met” there)

---

## 1. Executive summary

| Area | Verdict |
|------|---------|
| **Phase 2 — §16 two-layer registration** | **Partial–Strong** — core APIs and primary UI delivered; several PRD polish items remain |
| **Invoice (assign / redeem / lockout)** | **Met** (code review); manual QA pending |
| **Team workflows (create / join / transfer)** | **Met** (server); **Partial** (client — boys join only; owner UI API-only) |
| **`active_division` exclusivity** | **Met** on new workflow paths |
| **Legacy retirement (Captain / claim slot)** | **Partial** — `map-player` deprecated; old admin mapping UI and roles still present |
| **Phase 1.5 (unchanged this sprint)** | See [phase-1.5-rtm-qa-may-2026.md](phase-1.5-rtm-qa-may-2026.md) |

**Bottom line:** Phase 2 **backend and admin queue UI** are in place and traceable. **End-to-end product** is testable for: admin assigns code → user redeems on Profile → join on boys/girls Teams → **owner approves on team card** → admin adds to roster after `active`. Remaining gaps: owner squad-role UI on Teams, full `mappedPlayerInfo` retirement, automated tests, PO manual QA (P2-T*), production deploy verification.

**Suggested overall Phase 2 readiness:** ~**80%** PRD alignment (owner UI, girls join/vote, 5+GK added May 2026; PO QA still pending).

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
| **Code review** | Verified by reading implementation |
| **Build** | `tsc` / `vite build` in session |
| **Manual pending** | Requires local or deployed smoke test |
| **Not run** | No verification performed |

---

## 3. Requirements Traceability Matrix — Phase 2 (§16 & workflows)

### 3.1 Layer 1 — Website account

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-01 | §16 | Website login (Google / email) before tournament | `server/src/routes/auth.ts`, `client/src/pages/admin/Login.tsx` | Met (pre-existing) | Not run |
| P16-01b | §6.B | `users.role` = `admin` \| `user` only (platform) | `schema.prisma` `UserRole`; JWT still exposes legacy strings in adapters | Partial | Code review |

### 3.2 Layer 2 — `season_registrations` & division lock

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-02 | §16 | `season_registrations` status machine | `RegistrationService.upsertSeasonRegistration`, statuses in `schema.prisma` | Met | Code review |
| P16-02b | §16 | `GET` registration summary for UI | `GET /api/users/registration?division=` → `getRegistrationStatus` | Met | Manual pending |
| P16-06 | §6.B | `active_division` set on first join/create on a side | `RegistrationService.lockActiveDivision` | Met | Manual pending |
| P16-07 | §6.B | Cannot join opposite division once locked | `RegistrationService.assertDivisionAccess` | Met | Manual pending |
| P16-07b | §16 UI | Banner / block wrong side | Profile cards per division; no hard block on browsing other side | Partial | Manual pending |

### 3.3 Invoice

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-03 | §16 | Admin assigns invoice per user + season | `POST /api/admin/users/invoice`, `RegistrationService.assignInvoice` | Met | Manual pending |
| P16-03b | §16 | Alphanumeric code; store hash only | `generateInvoiceCode`, `bcrypt.hash`, `invoice_codes.code_hash` | Met | Code review |
| P16-03c | §16 | User redeems on profile | `POST /api/users/redeem-invoice`, `TournamentRegistrationCard.tsx` | Met | Manual pending |
| P16-03d | §16 | `season_registrations` → `active` on redeem | `redeemInvoice` transaction updates registration | Met | Code review |
| P16-04 | §6.C | 5 wrong attempts → lock until next calendar day (Redis) | `InvoiceRateLimitService.ts`, Asia/Jerusalem TTL | Met | Manual pending (needs `REDIS_URL`) |
| P16-04b | §6.C | Memory fallback when no Redis (dev) | `InvoiceRateLimitService` in-memory map | Partial (dev only) | Code review |
| P16-08 | §16 Admin | Queue: users awaiting invoice | `listPendingWorkflows` → `awaitingInvoice` in `RegistrationWorkflowAdmin` | Partial (lists `join_pending` + `awaiting_invoice`; assign by UUID) | Manual pending |

### 3.4 Team creation

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-05a | §16 | User submits team creation (no invoice required first) | `POST /api/teams/creation-request` (+ `-girls`) | Met | Manual pending |
| P16-05b | §16 | Admin approves → `teams` row + `owner_user_id` | `approveTeamCreation` | Met | Manual pending |
| P16-05c | §6.D | Owner added to roster on approve | `approveTeamCreation` creates `players` row with `squadRole: captain` | Met | Code review |
| P16-05d | §16 | Profile banner pending creation | `TournamentRegistrationCard`, legacy `pendingTeamRequest` proxy on `POST /users/request-team` | Partial | Manual pending |
| P16-05e | Plan | Admin queue UI for creation | `RegistrationWorkflowAdmin` approve/reject | Met | Manual pending |

### 3.5 Team join

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-10 | §6.E | Join request from correct division pages | `TeamRegistrationActions` on boys `Teams.tsx` and `GirlsTeams.tsx` | Met | Manual pending |
| P16-11 | §6.E | Owner approve → `owner_approved` | `ownerReviewJoin`, `POST /:id/owner-review-join` | Met (API) | Manual pending |
| P16-11b | §6.E | Owner approve UI on team card | `TeamRegistrationActions.tsx` on `Teams.tsx`, `GirlsTeams.tsx` | Met | Manual pending |
| P16-11c | §6.E | Admin final approve → roster row | `adminReviewJoin`; requires `season_registrations.status = active` | Met | Manual pending |
| P16-12 | §6.E | Second pending join invalidates all pending | `submitJoinRequest` → `invalidated` | Met | Manual pending |
| P16-13 | §6.E | Same team re-request after 1 day if rejected | `recentReject` 24h check in `submitJoinRequest` | Met | Manual pending |
| P16-14 | §6.E | Cannot join if already on roster | Check in `submitJoinRequest` | Met | Code review |
| P16-15 | §16 | Join allowed before invoice; roster needs `active` | Implemented as documented in service | Met | Code review |
| P16-16 | Plan | Deprecate claim-slot flow | `POST /users/map-player` → **410** | Met | Manual pending |
| P16-17 | §16 | `/auth/me` includes registration + roster hydration | `authController.hydrateUserPayload` | Met | Manual pending |

### 3.6 Team transfer

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-20 | §6.E | Player-initiated transfer request | `POST /api/teams/transfer-request` | Met | Manual pending |
| P16-21 | §6.E | One pending transfer at a time | Check in `submitTransfer` | Met | Code review |
| P16-22 | §6.E | Admin approve moves player row | `adminReviewTransfer` | Met | Manual pending |
| P16-23 | Plan | Transfer queue in admin UI | `RegistrationWorkflowAdmin` | Met | Manual pending |
| P16-24 | — | User transfer UI (pick target team) | No dedicated Profile/Teams transfer UI | Not Met | — |

### 3.7 Team owner — squad roles & roster

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-30 | §6.D | Owner sets `squad_role` (captain, GK, attack, defense) | `PATCH /:id/squad-roles`, `setSquadRoles` | Met (API) | Manual pending |
| P16-31 | §6.D | `squad_role` null = bench; non-null = starting | `TeamDataService.formatPlayer` → `lineup: 'starting' \| 'bench'` | Met | Code review |
| P16-32 | §6.D | One captain per team | `setSquadRoles` clears other captains | Met | Code review |
| P16-33 | §6.D | Max 5 outfield + 1 GK enforced | `RegistrationService.assertFootballLineup` in `setSquadRoles` | Met | Code review |
| P16-34 | Plan | Hebrew UI: הרכב פתיחה / ספסל on Teams | No owner role dropdown on `Teams.tsx` | Not Met | — |
| P16-35 | Plan | Owner badge on profile/roster | Still uses legacy `Captain` / `isCaptain` in UI | Partial | Code review |
| P16-36 | Plan | Owner `add-self` to roster | `POST /:id/roster/add-self`, `addOwnerToRoster` | Met (API) | Manual pending |
| P16-37 | §6.E | Owner cannot approve invoice/join/transfer (admin only) | Owner routes limited to join review + squad | Met | Code review |

### 3.8 Legacy retirement & PRD gaps (Phase 2 adjacent)

| Req ID | PRD ref | Requirement | Evidence | Status | Test |
|--------|---------|-------------|----------|--------|------|
| P16-09 | §6.B | Drop Captain/Player legacy roles | `Captain` still in `teamController`, `RosterManager`, Profile | Not Met | — |
| P16-09b | Admin | Old `/admin/team-requests`, `/admin/user-mappings` | APIs remain; **UI hidden** in `RosterManager` (`LEGACY_ROSTER_WORKFLOWS=false`) | Partial | Code review |
| P16-40 | §6.G | Girls MVP = team vote (`votes.team_id`) | `POST /api/votes-girls`, `voteController` + `GirlsTeams.tsx` | Met | Manual pending |
| P16-41 | §6.H | Encrypt `personal_id` on write | `personalIdEnc` column; import paths unchanged | Partial | Not run |
| P16-42 | §6.D | Roster players must have `user_id` | Enforced on new workflow creates; seed may have null | Partial | Code review |

---

## 4. API traceability index

| Method | Path | Controller / service | PRD |
|--------|------|----------------------|-----|
| GET | `/api/users/registration` | `registrationController.getRegistrationStatus` | §16 |
| POST | `/api/users/redeem-invoice` | `registrationController.redeemInvoice` | §16 |
| POST | `/api/users/map-player` | `userController` → **410** | Deprecated |
| POST | `/api/users/request-team` | Proxies `RegistrationService.submitTeamCreation` (boys) | §16 |
| GET | `/api/teams/available` | `listAvailableTeams` | Plan |
| POST | `/api/teams/creation-request` | `submitTeamCreation` | §16 |
| POST | `/api/teams/transfer-request` | `submitTransferRequest` | §6.E |
| POST | `/api/teams/:id/join-request` | `submitJoinRequest` | §6.E |
| GET | `/api/teams/:id/join-requests-pending` | `listOwnerJoinRequests` | §6.E |
| POST | `/api/teams/:id/owner-review-join` | `ownerReviewJoin` | §6.E |
| PATCH | `/api/teams/:id/squad-roles` | `setSquadRoles` | §6.D |
| POST | `/api/teams/:id/roster/add-self` | `addSelfToRoster` | Plan |
| GET | `/api/admin/workflows` | `adminWorkflowController.listWorkflowQueues` | §16 Admin |
| POST | `/api/admin/users/invoice` | `assignUserInvoice` | §16 |
| PATCH | `/api/admin/requests/creation/:id` | `reviewCreationRequest` | §16 |
| PATCH | `/api/admin/requests/join/:id` | `reviewJoinRequest` | §16 |
| PATCH | `/api/admin/requests/transfer/:id` | `reviewTransferRequest` | §16 |

Mirror under `/api/teams-girls` via `setGirlsDivision` middleware (same router).

---

## 5. Client traceability index

| UI | Component / page | API used | Status |
|----|------------------|----------|--------|
| Profile — invoice + status | `TournamentRegistrationCard.tsx` (boys + girls) | `usersAPI.getRegistration`, `redeemInvoice` | Met |
| Profile — join hint | `Profile.tsx` | — | Partial |
| Teams — join button | `Teams.tsx` (boys only) | `registrationAPI.submitJoin` | Partial |
| Admin — workflows | `RegistrationWorkflowAdmin.tsx` in `RosterManager` | `adminAPI.getWorkflowQueues`, assign/review | Met |
| Owner — pending joins | — | API in `client.ts` only | Not Met (UI) |
| Owner — squad roles | — | API in `client.ts` only | Not Met (UI) |
| Girls — join/create | `GirlsTeams.tsx` | No `registrationAPI` usage found | Not Met |

---

## 6. QA test summary

### 6.1 Automated checks (2026-05-18 session)

| Check | Result | Notes |
|-------|--------|-------|
| `server`: `npx tsc --noEmit` | **Pass** | After Phase 2 implementation |
| `client`: `npm run build` | **Pass** | Vite production build |
| Unit / integration tests | **Not available** | No test suite for registration |
| Playwright / E2E | **Not available** | |

### 6.2 Recommended manual test plan — Phase 2

| # | Scenario | Steps | Expected | Priority |
|---|----------|-------|----------|----------|
| P2-T1 | Admin assign invoice | Admin → סגל ורישום → workflows → assign UUID | Plain code returned once; DB `invoice_codes` + registration `invoice_assigned` | P0 |
| P2-T2 | User redeem | Profile → enter code (boys card) | `active`; wrong code decrements attempts | P0 |
| P2-T3 | Invoice lockout | 5 wrong codes | Blocked until next Jerusalem day (Redis) | P1 |
| P2-T4 | Create team | Profile or `POST /teams/creation-request` → admin approve | Team + owner on roster | P0 |
| P2-T5 | Join flow | Teams → בקש להצטרף → owner API approve → admin approve | Player row only if registration `active` | P0 |
| P2-T6 | Multi-join invalidate | Two pending joins (different teams) | First invalidated when second submitted | P1 |
| P2-T7 | Division lock | Join on boys then attempt girls create | Error on girls | P0 |
| P2-T8 | Transfer | API or future UI → admin approve | `players.team_id` updated | P1 |
| P2-T9 | Legacy map-player | `POST /users/map-player` | 410 + Hebrew message | P2 |
| P2-T10 | Girls API parity | Repeat P2-T4/T5 on `/teams-girls` | Same rules, girls season | P1 |
| P2-T11 | Deploy | Render `/api/admin/workflows` with auth | 200 after deploy | P0 |

### 6.3 Defects / risks

| ID | Severity | Description | Mitigation |
|----|----------|-------------|------------|
| P2-R01 | High | Owner cannot approve joins from UI | Add owner panel on expanded team card |
| P2-R02 | Medium | Girls pages lack join/create buttons | Wire `GirlsTeams` + Profile girls creation path |
| P2-R03 | Medium | Admin assign invoice requires raw user UUID | Add user picker / email lookup in admin UI |
| P2-R04 | Medium | Dual admin paths (legacy mappings + workflows) | Remove or hide legacy tabs when workflows stable |
| P2-R05 | Low | No 5+GK lineup cap on role assignment | Add validation in `setSquadRoles` |
| P2-R06 | Low | `leave-team` still legacy JSON mapping | Reimplement against Prisma roster |
| P2-R07 | High (prod) | Invoice lockout weak without `REDIS_URL` | Require Redis in production (`env.ts`) |

---

## 7. File change index (Phase 2)

| File | Role |
|------|------|
| `server/src/services/RegistrationService.ts` | Core business rules |
| `server/src/services/InvoiceRateLimitService.ts` | Redis / memory rate limit |
| `server/src/controllers/registrationController.ts` | User/owner routes |
| `server/src/controllers/adminWorkflowController.ts` | Admin queues |
| `server/src/controllers/authController.ts` | Hydrate `tournamentRegistration` |
| `server/src/controllers/userController.ts` | Deprecate map-player; proxy request-team |
| `server/src/routes/users.ts`, `teams.ts`, `admin.ts` | Route wiring |
| `server/src/services/TeamDataService.ts` | `squadRole`, `lineup` on players |
| `client/src/components/profile/TournamentRegistrationCard.tsx` | Invoice UI |
| `client/src/components/admin/RegistrationWorkflowAdmin.tsx` | Admin queues |
| `client/src/pages/Profile.tsx`, `Teams.tsx` | User-facing hooks |
| `client/src/api/client.ts` | `registrationAPI`, admin workflow methods |
| `context.md`, `status.md` | Phase 2 status |

---

## 8. Cross-reference to Phase 1.5 RTM

| Phase 1.5 item | Phase 2 impact |
|----------------|----------------|
| P16-* (was Not Met) | See §3 above — most core items now Met or Partial |
| P15-* girls UX | Unchanged; still Partial (archive placeholder, etc.) |
| INF-05 schema-only | Now **used** by registration services |

Update [phase-1.5-rtm-qa-may-2026.md](phase-1.5-rtm-qa-may-2026.md) §3.4 if you want a single doc; this report supersedes Phase 2 rows in that section as of 2026-05-18.

---

## 9. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Implementer | Agent | 2026-05-18 | Code review + server/client build |
| Product owner | _Pending_ | | Execute P2-T1–P2-T11 |
| QA | _Pending_ | | No formal manual execution recorded |

---

## 10. Related documents

- [PRD-database-schema.md](../.incoming/PRD-database-schema.md) — §16, §6
- [phase-1.5-rtm-qa-may-2026.md](phase-1.5-rtm-qa-may-2026.md)
- [status.md](../status.md)
- [context.md](../context.md)
- [is-5568-wcag-aa-pass-may-2026.md](is-5568-wcag-aa-pass-may-2026.md) — accessibility for new Profile/admin controls (manual pass recommended)
