# Ramadan Tournament — Backend API

Node.js / Express API with **PostgreSQL (Prisma)** and optional **Redis** caching.

See also [`../context.md`](../context.md) for architecture and the full fresh-season workflow.

## Quick start

### 1. Environment

Copy [`.env.example`](.env.example) to `.env`. The server loads **only** `server/.env`.

**Mock dev (no Postgres):**
```powershell
npm run dev:mock
```
Uses `env.mock` and `data/*.json`. Admin: `admin` / `admin123`.

**Full stack (Postgres):** set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `REDIS_URL`, `SMTP_*`, `GOOGLE_CLIENT_ID`.

Optional fresh-season overrides:
- `SEASON_YEAR_MONTH` (default `2026-06`)
- `SEASON_DISPLAY_NAME` (default `טורניר קיץ 2026`)

### 2. Install and migrate

```powershell
npm install
npm run db:migrate
```

### 3. Seed or fresh start

| Command | Purpose |
|---------|---------|
| `npm run db:seed` | Wipe + load demo teams/matches from `data/*.json` (local dev) |
| `npm run db:fresh` | Wipe + **season + admin only** (no teams/players/matches) |

Remote Postgres requires `--yes`:
```powershell
npm run db:fresh -- --yes
```

### 4. Run API

```powershell
npm run dev
```

API: `http://localhost:5000`

## Database scripts

Run from `server/` with `DATABASE_URL` set.

### `db:fresh` — clean tournament start

Wipes all tables, then creates:
- One active **boys** football season
- Admin user from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- Baseline banned words (`spam`, `test`)

Does **not** create teams, players, or matches.

### `fixtures:generate` — round-robin schedule

After teams exist and are **active**, generate group-stage fixtures (single round-robin):

```powershell
npm run fixtures:generate -- --help
npm run fixtures:generate -- --start-date 2026-07-01 --dry-run
npm run fixtures:generate -- --start-date 2026-07-01
npm run fixtures:generate -- --start-date 2026-07-01 --replace --yes
```

| Flag | Default | Description |
|------|---------|-------------|
| `--start-date` | *(required)* | `YYYY-MM-DD` |
| `--division` | `boys` | `boys` or `girls` |
| `--matches-per-day` | `2` | Matches per calendar day before advancing |
| `--times` | `18:00,20:00` | Jerusalem wall-clock times (comma-separated) |
| `--location` | `מרכז צעירים` | Venue on all generated matches |
| `--replace` | off | Delete existing group matches (+ goals) first |
| `--dry-run` | off | Print pairings only |
| `--yes` | — | Required when DB host is not localhost |

Edit real dates/times in the client Admin panel → **ניהול משחקים**.

### Other

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Full demo seed from `data/*.json` |
| `npm run migrate:personal-ids` | Re-encrypt legacy plaintext ת"ז in `*_enc` columns (requires `PERSONAL_ID_KEY`) |
| `npm run migrate:user-emails` | Canonicalize `users.email` (Gmail dots, `+tag`, `googlemail.com`) |

**Migrations:** production and Render builds run `db:migrate` automatically (`scripts/render-api-build.mjs`). Do not use `prisma db push` for prod — partial indexes (e.g. active-only jersey uniqueness) exist only in migration SQL.

**Personal ID migration:** dry-run first: `npm run migrate:personal-ids -- --dry-run`. Live on Render: `npm run migrate:personal-ids -- --yes`. Then set `PERSONAL_ID_MIGRATION_DONE=1` in production env.

**User email migration:** dry-run first: `npm run migrate:user-emails -- --dry-run`. Live: `npm run migrate:user-emails -- --yes`. Conflicting rows (two users normalizing to the same address) are logged and skipped for manual merge.

**Production:** do not run `db:seed` or `db:fresh` unless you intend to wipe data.

## Admin role management

After `db:fresh`, only the env admin exists. Promote Google/email users:

- **UI:** `/admin` → tab **משתמשים** — search by name/email, grant or revoke `admin`.
- **API** (admin JWT required):
  - `GET /api/admin/users?q=search` — min 2 characters
  - `PATCH /api/admin/users/:id/role` — body `{ "role": "admin" | "user" }`

Guards: cannot demote yourself or the last admin. The affected user must **log in again** for their JWT role to update (API checks DB on each request).

## Identity rate limiting (`IdentityRateLimitService`)

Failed personal-ID + birth-year submissions are rate-limited per user and season:

- **Service:** `src/services/IdentityRateLimitService.ts`
- **Limit:** 3 failed attempts per calendar day (Asia/Jerusalem midnight reset)
- **Redis key prefix:** `rt:identity:attempts:{userId}:{seasonId}`
- **Fallback:** in-memory map when `REDIS_URL` is unset (local dev only)

`db:fresh` (`prisma/seed-empty.ts`) calls `IdentityRateLimitService.clearAllAttempts()` to wipe counters.

**Deploy note:** After deploying this rename from the legacy `rt:invoice:attempts:` prefix, clear stale Redis keys if users were locked under the old prefix (or run `clearAllAttempts` once on deploy). New attempts use `rt:identity:attempts:` only.

## API overview

Full route catalog: [`../docs/server/API_REFERENCE.md`](../docs/server/API_REFERENCE.md).

### Public
- `GET /api/health`
- `GET /api/teams`, `/api/matches`, `/api/news`, `/api/stats/*`

### Auth
- `POST /api/auth/login`, `POST /api/auth/google`, `GET /api/auth/me`

### Admin (authenticated + `admin` role)
- Matches: `POST|PUT|DELETE /api/matches`, `POST /api/matches/sync-playoffs`
- Registration workflows: `GET /api/admin/workflows`, `GET /api/admin/workflows/user-search`, `POST /api/admin/users/identity`, `PATCH /api/admin/requests/{creation|join|transfer}/:id`
- User roles: `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`

### Registration (authenticated user)
- `GET /api/users/registration` — season registration summary
- `POST /api/users/verify-identity` — submit personal ID + birth year
- `POST /api/users/cancel-registration-request` — cancel pending join/creation request

## Service ownership

| Service | Owns |
|---------|------|
| `RegistrationService` | Facade over query/workflow/identity helpers |
| `RegistrationQueryService` | Registration summary, team list, admin user search |
| `RegistrationWorkflowService` | Join/creation/transfer requests, squad roles, admin queues |
| `RegistrationIdentityService` | Encrypted personal ID match (user ↔ admin) |
| `IdentityRateLimitService` | Failed identity submission throttles |
| `TeamRosterService` | Admin roster mutations (Prisma) |
| `TeamDataService` | Cached public team documents |
| `PlayerService` | Avatar sync, voluntary leave |
| `SeasonService` / `AdminSeasonService` | Active season, girls season admin |
| `AdminUserService` | Platform admin role search and promotion |
| `MatchDataService` / `StatsService` / `PlayoffService` | Fixtures, standings, playoffs |
| `NewsDataService` | Division-scoped news |
| `PointsStatsService` / `PointEntryService` | Girls points tournament |
| `CacheService` | Redis read-through cache (`rt:` keys) |
| `AuthRateLimitService` | Login throttles |

Controllers stay thin: validate input, call the owning service, map errors to HTTP.

## Legacy routes removed

| Removed route | Replacement |
|---------------|-------------|
| `POST /api/users/redeem-invoice` | `POST /api/users/verify-identity` |
| `POST /api/users/map-player` | `POST /api/teams/:id/join-request` |
| `POST /api/admin/users/invoice` | `POST /api/admin/users/identity` |
| `GET /api/admin/user-mappings` | Admin → סגל ורישום → `RegistrationWorkflowAdmin` |
| `PATCH /api/admin/user-mappings/:userId` | Same |

## Local smoke tests

```powershell
npm run test
curl http://localhost:5000/api/health
curl http://localhost:5000/api/teams
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [`../docs/server/BUSINESS_LOGIC.md`](../docs/server/BUSINESS_LOGIC.md) | Registration flows, services, auth matrix |
| [`../docs/server/API_REFERENCE.md`](../docs/server/API_REFERENCE.md) | Full route catalog |
| [`../docs/README.md`](../docs/README.md) | Documentation index |

See [`../docs/server/API_REFERENCE.md`](../docs/server/API_REFERENCE.md) for the complete API list (summary above is abbreviated).

## Project layout

```
server/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts           # demo data from data/*.json
│   ├── seed-empty.ts     # db:fresh
│   └── wipeDatabase.ts
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/         # RegistrationService, SeasonService, …
│   ├── scripts/
│   │   └── generate-group-fixtures.ts
│   └── index.ts
└── package.json
```
