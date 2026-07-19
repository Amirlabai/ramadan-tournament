# Agent Handoff

Compact implementation guide for Cursor agents and contributors.

**Canonical docs:** [`docs/README.md`](../README.md)

---

## Read first

| Doc | When |
|-----|------|
| [`docs/client/ARCHITECTURE.md`](../client/ARCHITECTURE.md) | UI, routes, auth, registration states |
| [`docs/server/BUSINESS_LOGIC.md`](../server/BUSINESS_LOGIC.md) | Registration flows, services, auth matrix |
| [`docs/server/API_REFERENCE.md`](../server/API_REFERENCE.md) | Route catalog |
| [`docs/product/PRD-database-schema.md`](../product/PRD-database-schema.md) | Schema + product intent |
| [`docs/review/phase-2-rtm-qa-may-2026.md`](../review/phase-2-rtm-qa-may-2026.md) | QA traceability (may lag code) |
| [`status.md`](../../status.md) | Milestones, open QA, deploy checklist |
| [`context.md`](../../context.md) | Env vars, deploy, architecture overview |
| [`.cursor/rules/no-em-dashes-product-copy.mdc`](../../.cursor/rules/no-em-dashes-product-copy.mdc) | No `—` in UI/SEO/emails; empty cells via `displayOrDash` |

---

## Req → file map (hot paths)

### Registration identity (Layer 2)

| Concern | Files |
|---------|-------|
| User submit PID+BY | `server/src/services/RegistrationIdentityService.ts` → `submitUserIdentity` |
| Admin assign | `assignAdminIdentity`, `tryFinalizeIdentityMatch` |
| Rate limit | `server/src/services/IdentityRateLimitService.ts` |
| Shared validation | `shared/israeliIdValidation.ts`, `shared/birthYearBounds.ts` |
| Server validation | `server/src/utils/personalIdValidation.ts` |
| Status labels | `shared/registrationStatus.ts` |
| Profile UI | `client/src/components/profile/TournamentRegistrationCard.tsx` |
| Admin UI | `client/src/components/admin/RegistrationWorkflowAdmin.tsx` |
| Routes | `server/src/routes/users.ts`, `server/src/routes/admin.ts` |

### Workflows (join / create / transfer)

| Concern | Files |
|---------|-------|
| Service | `server/src/services/RegistrationWorkflowService.ts` |
| Facade | `server/src/services/RegistrationService.ts` |
| Division lock | `server/src/services/registrationHelpers.ts` |
| Teams routes | `server/src/routes/teams.ts` |
| Client actions | `client/src/components/registration/TeamRegistrationActions.tsx` |

### Teams and roster

| Concern | Files |
|---------|-------|
| Public reads | `server/src/services/TeamDataService.ts` |
| Admin roster | `server/src/services/TeamRosterService.ts` |
| Client teams pages | `client/src/pages/Teams.tsx`, `client/src/pages/girls/GirlsTeams.tsx` |

### Auth (Layer 1)

| Concern | Files |
|---------|-------|
| Routes | `server/src/routes/auth.ts` |
| Login UI | `client/src/pages/admin/Login.tsx` |
| Session | `client/src/contexts/AuthContext.tsx` |
| Cookies | httpOnly `rt_session`, axios `withCredentials` |

### Stats / admin

| Concern | Files |
|---------|-------|
| Boys stats | `server/src/services/StatsService.ts`, `server/src/routes/stats.ts` |
| Girls points | `server/src/services/PointsStatsService.ts` |
| Admin panel | `client/src/pages/admin/AdminPanel.tsx` |
| Playoffs | `server/src/services/PlayoffService.ts` |

---

## Smoke commands

```powershell
# From repo root — 33 unit + integration tests
npm run test

# Health (full API on port 5000)
curl http://localhost:5000/api/health

# Mock dev (no Postgres)
npm run dev:mock
# Admin: admin / admin123 (see server/env.mock)
```

---

## Do-not-break rules

1. **Division lock** — `active_division` set on first boys/girls action; cross-division requests must fail.
2. **One pending request** — user cannot have simultaneous join + creation pending for same season.
3. **Never return full PID** in JSON — masked admin display only; user APIs omit ciphertext.
4. **Identity before roster** — join/creation approval requires `season_registrations.status = active` + matched identity.
5. **Platform admin vs captain** — roster mutations admin-only; captains approve joins on Profile/Teams only.
6. **IS 5568** — all `client/**` UI changes must comply; see [`.cursor/rules/israeli-accessibility-is5568.mdc`](../../.cursor/rules/israeli-accessibility-is5568.mdc).
7. **No em dashes in product copy** — never `—` in UI/SEO/emails/API errors; empty cells use `-` via `displayOrDash`; see [`.cursor/rules/no-em-dashes-product-copy.mdc`](../../.cursor/rules/no-em-dashes-product-copy.mdc).

---

## Open gaps (from status.md)

- [ ] **Deploy:** `prisma migrate deploy` on Render before API deploy
- [ ] **PO manual QA P2-T*:** Personal ID registration E2E (user-first, admin-first, mismatch, rate limit)
- [ ] **Production deploy** verification for latest `-girls` routes and identity APIs
- [ ] Accessibility coordinator contact on `/accessibility` (placeholders)

---

## Legacy (shrinking)

- `invoice_codes` table — historical only; do not reintroduce redeem/assign invoice routes.
- `mappedPlayerInfo` on `users` — legacy display/hydration; prefer `season_registrations` + `players.user_id`.
- Removed routes: `/redeem-invoice`, `/map-player`, `/admin/users/invoice`, `/admin/user-mappings`.

---

## Monorepo layout

```
client/     React SPA
server/     Express + Prisma + Redis
shared/     @ramadan-tournament/shared (ID + birth year validation)
docs/       Canonical documentation (this tree)
data/       Bootstrap JSON for seed/mock
.incoming/  New doc drops → process into docs/
```
