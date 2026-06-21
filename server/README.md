# Ramadan Tournament - Backend Server

Node.js/Express backend API with MongoDB for tournament management.

## Quick Start

### 1. Configure Environment

Copy [`server/.env.example`](.env.example) to `server/.env` and fill in values. **Server reads only `server/.env`** (not a repo-root `.env`).

**Option A — Mock dev (no Postgres, e.g. while Render is paused):**
```bash
# From server/ or repo root
npm run dev:mock
```
Uses `env.mock` (committed) and `data/*.json`. Admin: `admin` / `admin123`.

**Option B — Full stack (PostgreSQL):** copy `server/.env.example` to `server/.env` and set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_*` (do not set `MOCK_DEV_DATA`).

Required variables (Postgres mode):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT (generate with `openssl rand -base64 32`)
- `ADMIN_USERNAME` - Initial admin username
- `ADMIN_PASSWORD` - Initial admin password
- `SMTP_USER` - SMTP username for sending verification emails
- `SMTP_PASS` - SMTP password for sending verification emails
- `GEMINI_API_KEY` - API key for Google Gemini to generate AI summaries

### 2. Install Dependencies
```bash
# From repository root
cmd /c npm install

# Or directly in server folder
cd server
cmd /c npm install
```

### 3. Migrate Data
Import existing JSON data:
```bash
cmd /c npm run migrate
```

### 4. Start Development Server
```bash
cmd /c npm run dev
```

Server starts on `http://localhost:5000`

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/teams` - Get all teams
- `GET /api/matches` - Get all matches
- `GET /api/news` - Get all news
- `GET /api/stats/standings` - Get calculated standings
- `GET /api/stats/top-scorers` - Get top scorers
- `GET /api/stats/player-stats` - Get player statistics
- `GET /api/stats/dashboard` - Get dashboard summary

### Admin Endpoints (Require JWT)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/verify` - Verify registration OTP
- `POST /api/auth/resend-code` - Resend verification OTP
- `GET /api/auth/me` - Get current user
- `POST /api/matches` - Create match
- `PUT /api/matches/:id` - Update match
- `DELETE /api/matches/:id` - Delete match
- `POST /api/news` - Create news
- `PUT /api/news/:id` - Update news
- `DELETE /api/news/:id` - Delete news

## Testing Locally

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"your-password\"}"
```

### Get Teams
```bash
curl http://localhost:5000/api/teams
```

### Get Standings
```bash
curl http://localhost:5000/api/stats/standings
```

## MongoDB Atlas Setup

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (M0 Free tier)
4. Add database user (Database Access)
5. Allow connections from anywhere (Network Access → IP Whitelist → `0.0.0.0/0`)
6. Get connection string:
   - Click "Connect"
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `tournament`

Example: 
```
mongodb+srv://admin:mypassword@cluster0.abc123.mongodb.net/tournament?retryWrites=true&w=majority
```

## Season Maintenance

To close a season and prepare for a public showcase:

1. **Archive & Anonymize**:
   ```bash
   npx tsx src/scripts/archive-season.ts
   ```
   This will:
   - Create timestamped backups (e.g. `teams_2026_03`).
   - Anonymize player names/photos in the active `teams` collection for the showcase.
   - Skip `users` to keep your admin/captain logins working.

2. **Historical Record**:
   - Use the `/archive` page in the frontend to view the "frozen" results of past seasons.

## Project Structure
```
server/
├── src/
│   ├── config/       # Environment and database config
│   ├── models/       # Mongoose schemas
│   ├── routes/       # Express routes
│   ├── controllers/  # Route handlers
│   ├── middleware/   # Auth, error handling
│   ├── services/     # Business logic (stats)
│   ├── scripts/      # Migration scripts
│   └── index.ts      # Server entry point
├── package.json
└── tsconfig.json
```

## Next Steps
- Set up React frontend
- Configure deployment to Render
- Add environment variables to hosting platform
