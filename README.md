# Ramadan Tournament 2026

A full-stack tournament management system with real-time statistics, news management, and community engagement features.

## Features

### Core Functionality
- **Live Tournament Tracking**: Real-time standings, top scorers, and match results
- **Player Profiles**: Comprehensive stats for all players across teams
- **Responsive Design**: Mobile-friendly interface with green/yellow theme
- **RTL Support**: Full Hebrew language support with proper RTL layout

### User Features
- **Dashboard**: Quick overview of tournament status and upcoming matches
- **Team Pages**: Detailed team rosters and statistics
- **Schedule**: Complete match schedule with live results
- **Stats**: Player rankings, top scorers, and detailed statistics
- **Anonymous Comments**: Engage with match discussions (with profanity filtering)
- **Iftar Timer**: Live Ramadan countdown widget in bottom-left corner
- **Rocket Alerts Widget**: Real-time rocket alert statistics for Kfar Kama & Reihaniya
- **News Banner**: Collapsible top banner — auto-collapses on scroll, click to re-expand

### Admin Features
- **Secure Authentication**: JWT-based admin login system
- **CSV Player Import**: Bulk import players via CSV upload
- **News Management**: Create, edit, and delete news announcements
- **Match Management**: View and manage match data
- **Banned Words Management**: Multi-language profanity filter control
- **Comment Moderation**: Search and remove inappropriate comments

## Architecture

### Full Stack Application

**Frontend:** React 19 + TypeScript + Vite  
**Backend:** Node.js + Express + PostgreSQL (Prisma)  
**Hosting:** Vercel (Frontend) + Render (Backend + Postgres + Redis)

### Project Structure

```
ramadan-tournament/
├── client/                    # React frontend
│   ├── src/
│   │   ├── api/              # API client and endpoints
│   │   ├── components/       # Reusable components
│   │   │   ├── IftarTimer.tsx/css   # Ramadan countdown iframe widget
│   │   │   ├── AlarmsWidget.tsx/css # Rocket alerts stats widget
│   │   │   └── NewsBanner.tsx       # Collapsible news banner
│   │   ├── pages/            # Page components
│   │   └── types/            # TypeScript interfaces
│   └── public/               # Static assets
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── controllers/      # Business logic
│   │   ├── models/           # Database schemas
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth & validation
│   │   └── scripts/          # Utility scripts
├── .github/workflows/
│   ├── backup-postgres.yml   # Daily Postgres CSV backup
│   ├── fetch-alarms.yml      # Rocket alerts fetch (every 2 hours)
│   └── sync-photos.yml       # Production photos sync
└── scripts/                   # Python automation (see scripts/README.md)
    ├── backup_postgres.py
    ├── fetch_alarms.py
    ├── sync_photos.py
    └── requirements.txt
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (Render or local) for full API mode
- Git

### Development Setup

**Recommended (monorepo, from repo root):**

```bash
npm install          # workspaces: client, server, shared (shared `prepare` builds dist)
npm run dev          # build:shared once, then API + Vite together
```

Use `npm run dev:server` or `npm run dev:client` to run one side; each runs `build:shared` first.  
Do **not** use bare `npm run dev --workspace=server` — that skips the shared compile (server loads `@ramadan-tournament/shared` from `dist/`).

1. **Clone the repository**
   ```bash
   git clone https://github.com/Amirlabai/ramadan-tournament.git
   cd ramadan-tournament
   ```

2. **Setup Backend**
   ```bash
   cd server
   npm install
   
   # Create .env file with:
   # DATABASE_URL=postgresql://...
   # JWT_SECRET=your_secret_key
   # PORT=5000
   
   npm run db:migrate
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd client
   npm install
   
   # Create .env file with:
   # VITE_API_URL=http://localhost:5000
   
   npm run dev
   ```

4. **Seed Initial Data** (Optional)
   ```bash
   cd server
   npm run db:seed    # demo teams/matches from data/*.json
   # or: npm run db:fresh   # season + admin only
   ```

### Admin Access

Default admin credentials can be set via environment variables or created through the registration endpoint (first user).

## Data Management

### Importing Players

Upload a CSV file through the admin panel with the following format:

```csv
שם קבוצה,שם,משפחה,כינוי,מספר,קפטן
Team Name,First,Last,Nickname,10,true
```

### Managing Banned Words

Access the admin panel → Banned Words tab to:
- Add new profanity filters (English/Hebrew/Other)
- Remove existing banned words
- View all filtered words with language tags

### Comment Moderation

Access the admin panel → Comment Management tab to:
- View all user comments with match context
- Search comments by content or author
- Delete inappropriate comments

### Photo Management & Recovery
- **Photo Approval System**: Dedicated admin workflow for reviewing player-uploaded photos
- **Robust Storage**: Cross-device file move support for Windows/Linux/Docker environments
- **Photo Recovery Script**: `scripts/sync_photos.py` utility to download missing production photos to local disk

#### Syncing Photos to Local
If your local or production environment is missing player photos, use the sync tool:

```powershell
# One-time: python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
.\.venv\Scripts\python.exe scripts/sync_photos.py
```

See [scripts/README.md](scripts/README.md) for all Python scripts and GitHub Actions schedules.

Loads `server/.env` for `DATABASE_URL` and `VITE_API_URL` when present.

## Stats Automation & AI (Node.js Service)

The project includes an `AutomationService` in the Node.js backend to track tournament statistics and post news.
1. **Trigger**: Admin Panel → **צור עדכון יומי (AI)** or `POST /api/admin/trigger-automation`.
2. **Snapshot Mechanism**: Evaluates current standings against `stats_snapshots` to identify scoring changes or ranking shifts.
3. **AI Integration**: Uses **Gemini** to draft engaging updates in Hebrew.

### Required Server Environment Variables

| Secret           | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `GEMINI_API_KEY` | Google AI Studio API key (automation)                   |
| `DATABASE_URL`   | PostgreSQL connection string                            |
| `SMTP_USER`      | SMTP email (optional, for OTP)                          |
| `SMTP_PASS`      | SMTP app password (optional)                            |

## Color Scheme

- **Primary Green**: #2A6B11
- **Accent Yellow**: #FFFF00
- Fully supports RTL layout for Hebrew content

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting on auth endpoints
- Input validation on all endpoints
- Multi-language profanity filtering

## Technologies Used

### Frontend
- React 18
- TypeScript
- Vite
- Bootstrap 5
- Axios
- React Router

### Backend
- Node.js
- Express
- PostgreSQL with Prisma
- TypeScript
- JWT for authentication
- Multer for file uploads
- Robust cross-device file management
- CSV parsing

## Deployment

### Frontend (Vercel)
```bash
cd client
vercel deploy --prod
```

### Backend (Render)
Connected to GitHub for automatic deployments on push to main branch.

## Live Links

- **Frontend**: [https://ramadan-tournament-client.vercel.app](https://ramadan-tournament-client.vercel.app)

## API Documentation

### Public Endpoints
- `GET /api/teams` - Get all teams with players
- `GET /api/matches` - Get all matches
- `GET /api/news` - Get all news items
- `GET /api/stats` - Get tournament statistics
- `GET /api/comments/:matchId` - Get comments for a match
- `POST /api/comments` - Create a comment (anonymous)

### Admin Endpoints (Requires Authentication)
- `POST /api/admin/import-players` - Import players from CSV
- `GET /api/admin/banned-words` - Get banned words
- `POST /api/admin/banned-words` - Add banned word
- `DELETE /api/admin/banned-words/:id` - Remove banned word
- `GET /api/admin/comments` - Get all comments
- `DELETE /api/admin/comments/:id` - Delete comment

## Contributing

This is a tournament-specific project. For issues or suggestions, please contact the development team.

---

**Tournament Status**: Active  
**Last Updated**: 2026-03-02  
**Version**: 2.5.0
