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

**Production:** do not run `db:seed` or `db:fresh` unless you intend to wipe data.

## Admin role management

After `db:fresh`, only the env admin exists. Promote Google/email users:

- **UI:** `/admin` → tab **משתמשים** — search by name/email, grant or revoke `admin`.
- **API** (admin JWT required):
  - `GET /api/admin/users?q=search` — min 2 characters
  - `PATCH /api/admin/users/:id/role` — body `{ "role": "admin" | "user" }`

Guards: cannot demote yourself or the last admin. The affected user must **log in again** for their JWT role to update (API checks DB on each request).

## API overview

### Public
- `GET /api/health`
- `GET /api/teams`, `/api/matches`, `/api/news`, `/api/stats/*`

### Auth
- `POST /api/auth/login`, `POST /api/auth/google`, `GET /api/auth/me`

### Admin (authenticated + `admin` role)
- Matches: `POST|PUT|DELETE /api/matches`, `POST /api/matches/sync-playoffs`
- Registration workflows: `/api/admin/workflows`, `/api/admin/users/identity`, etc.
- User roles: `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`

**Legacy route aliases (sunset planned):** `POST /api/users/redeem-invoice` and `POST /api/admin/users/invoice` remain as backward-compatible aliases for identity verification and admin identity assignment. Prefer `POST /api/users/verify-identity` and `POST /api/admin/users/identity`.

## Local smoke tests

```powershell
curl http://localhost:5000/api/health
curl http://localhost:5000/api/teams
```

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
