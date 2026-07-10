# API Reference

Complete route catalog from [`server/src/routes/`](../../server/src/routes/) and mounts in [`server/src/index.ts`](../../server/src/index.ts).

**Auth legend:** `none` | `user` (JWT cookie) | `admin` | `owner` (team `ownerUserId`) | `claimed-captain` (roster `isCaptain` + matching `userId`) | `owner-or-captain` (squad captain or team owner)

**Common errors:** `401` unauthenticated | `403` forbidden / division lock | `404` not found | `429` rate limit

Mount prefixes: boys routes use default division; girls mirrors use `/api/*-girls` + `setGirlsDivision`.

---

## Health

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | none | Postgres + Redis status (or mock/worldcup-only mode) |

---

## Auth — `/api/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/register` | none | Email registration (rate limited) |
| POST | `/login` | none | Email/password login → `rt_session` |
| POST | `/google` | none | Google OAuth login |
| POST | `/logout` | user | Clear session cookie |
| GET | `/me` | user | Current user + `tournamentRegistration` (per division: `status`, `invoiceAlert`, `ownerPendingJoinCount` = claimed-captain pending join badge count, `ownedTeamId`, `onRoster`, pending requests) |
| POST | `/verify-email` | none | OTP verification |
| POST | `/resend-verification` | none | Resend OTP |

---

## Users — `/api/users`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/registration?division=` | user | Season registration summary |
| POST | `/verify-identity` | user | Submit PID + birth year (`?division=`) |
| POST | `/cancel-registration-request` | user | Cancel pending join/creation |
| POST | `/avatar` | user | Upload avatar (multipart) |
| DELETE | `/avatar` | user | Remove avatar |
| PATCH | `/player-profile` | user | Update player profile fields |
| POST | `/leave-team` | user | Voluntary leave roster (`?division=`) |
| POST | `/cancel-mapping` | user | Cancel legacy player mapping |

---

## Teams — `/api/teams` and `/api/teams-girls`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | All teams (cached) |
| GET | `/has-claimable-players` | none | `hasClaimablePlayers` — active season has unlinked roster slots not reserved by pending joins |
| GET | `/available` | user | Teams open for join |
| POST | `/creation-request` | user | Request new team (requires `active`) |
| POST | `/transfer-request` | user | Request transfer (rostered) |
| GET | `/:id` | none | Single team document |
| GET | `/:id/available-players` | none | Claimable roster slots |
| GET | `/:id/join-requests-pending` | claimed-captain | Claimed captain: list `pending` joins (syncs queue first) |
| POST | `/:id/join-request` | user | Submit join (`pending` if claimed captain exists, else `owner_approved` admin queue) |
| POST | `/:id/roster/add-self` | user | Self-add after approval |
| PATCH | `/:id/squad-roles` | owner-or-captain | Set squad roles (owner or roster captain); syncs join queue |
| POST | `/:id/owner-review-join` | claimed-captain | Claimed captain approve/reject join (`pending` → `owner_approved` / rejected). Route name is legacy. |
| GET | `/:id/requests` | user | Legacy captain requests |
| POST | `/:id/requests` | user | Legacy captain approve |
| PATCH | `/:id/metadata` | user | Owner/admin: name, description |
| POST | `/:id/logo` | user | Upload team logo |
| DELETE | `/:id/logo` | user | Delete team logo |
| POST | `/:id/players` | admin | Add player to roster |
| DELETE | `/:id/players/:memberId` | admin | Remove player |
| DELETE | `/:id/players/:memberId/photo` | admin | Delete player photo |
| PATCH | `/:id/players/:memberId/move` | admin | Move player to another team |

---

## Matches — `/api/matches`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | All matches |
| POST | `/sync-playoffs` | admin | Generate knockout from standings |
| POST | `/` | admin | Create match |
| PUT | `/:id` | admin | Update match |
| DELETE | `/:id` | admin | Delete match |

---

## News — `/api/news` and `/api/news-girls`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | All news (division-scoped) |
| POST | `/` | admin | Create news |
| PUT | `/:id` | admin | Update news |
| DELETE | `/:id` | admin | Delete news |

---

## Stats — `/api/stats`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | Dashboard payload |
| GET | `/dashboard` | none | Dashboard (alias) |
| GET | `/standings` | none | Group standings |
| GET | `/top-scorers` | none | Top scorers |
| GET | `/player-stats` | none | Per-player stats |
| GET | `/playoffs` | none | Knockout bracket matches |

---

## Stats (girls) — `/api/stats-girls`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | Girls dashboard |
| GET | `/dashboard` | none | Girls dashboard (alias) |
| GET | `/standings` | none | Points standings |

---

## Admin — `/api/admin`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/import-players` | admin | CSV player import |
| GET | `/banned-words` | admin | List banned words |
| POST | `/banned-words` | admin | Add banned word |
| DELETE | `/banned-words/:id` | admin | Remove banned word |
| GET | `/comments` | admin | All comments (moderation) |
| DELETE | `/comments/:id` | admin | Delete comment |
| GET | `/photos/pending` | admin | Pending player photos |
| POST | `/photos/approve` | admin | Approve photo |
| POST | `/photos/reject` | admin | Reject photo |
| POST | `/photos/delete` | admin | Force delete photo |
| GET | `/team-requests` | admin | Legacy team requests |
| POST | `/team-requests/:userId` | admin | Approve legacy request |
| POST | `/trigger-automation` | admin | AI stats news generation |
| GET | `/seasons` | admin | List seasons |
| GET | `/seasons/girls/summary` | admin | Girls season summary |
| POST | `/seasons/girls` | admin | Create girls season |
| POST | `/seasons/:seasonId/activate` | admin | Activate season |
| POST | `/seasons/:seasonId/teams` | admin | Add girls team |
| GET | `/point-entries` | admin | List point entries |
| POST | `/point-entries` | admin | Record points |
| GET | `/workflows` | admin | Registration workflow queues |
| GET | `/workflows/pending-count` | admin | Lightweight pending action count (`total`, optional `partial` + `skippedSeasonIds`) for nav dots |
| GET | `/workflows/user-search` | admin | Search users for identity assign |
| POST | `/users/identity` | admin | Assign admin PID + birth year |
| PATCH | `/requests/creation/:id` | admin | Review creation request |
| PATCH | `/requests/join/:id` | admin | Review join request |
| PATCH | `/requests/transfer/:id` | admin | Review transfer request |
| GET | `/users?q=` | admin | Search users (min 2 chars) |
| PATCH | `/users/:id/role` | admin | Set platform role |

---

## Comments — `/api/comments`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/:matchId` | none | Comments for match |
| POST | `/` | none | Create comment (rate limited, profanity filter) |

---

## Votes — `/api/votes` and `/api/votes-girls`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/results?category=` | none | Vote results |
| POST | `/` | user | Cast vote (boys: `playerMemberId`; girls: `teamId`) |
| GET | `/my?category=` | user | Current user's vote |

---

## Seasons — `/api/seasons`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/active?division=` | none | Active season for division (girls: points-mode season via `getActiveGirlsSeason`; 404 when none) |

---

## Archive — `/api/archive`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/?division=` | none | List archived seasons |
| GET | `/:yearMonth?division=` | none | Single archive snapshot |
| POST | `/create` | admin | Create archive (legacy script path) |

---

## Players (player zone) — `/api/players`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth` | none | PID + birth year → `rt_player` cookie |
| POST | `/logout` | none | Clear player cookie |
| POST | `/upload` | user | Upload head photo (multipart) |

---

## World Cup — `/api/worldcup` (when `WORLD_CUP_ENABLED`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/meta` | none | Tournament metadata |
| GET | `/matches` | none | WC matches |
| GET | `/teams` | none | WC teams |
| GET | `/stats/standings` | none | Group standings |
| GET | `/stats/top-scorers` | none | Top scorers |
| GET | `/stats/dashboard` | none | Dashboard stats |
| GET | `/stats/knockout` | none | Knockout bracket |

---

## Route count

~103 handlers across 14 route files (excluding mock-only routes in `createTestApp`).

See [`BUSINESS_LOGIC.md`](BUSINESS_LOGIC.md) for registration flows and authorization rules.
