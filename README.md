# Ramadan Tournament 2026

A GitHub Pages-hosted tournament management website with Python-powered statistics engine.

## Features

- **Live Tournament Tracking**: Real-time standings, top scorers, and match results
- **Player Profiles**: 54 players across 5 teams with detailed stats
- **Responsive Design**: Mobile-friendly interface with green/yellow color scheme
- **Automated Stats**: Python engine calculates standings, goals, and brackets
- **CSV Import**: Easy player data management via CSV file

## Project Structure

```
ramadan-tournament/
├── index.html                 # Main website
├── assets/
│   ├── css/style.css         # Custom styling
│   ├── js/app.js            # Frontend logic
│   └── images/              # Team logos and player photos
├── data/
│   ├── teams.json           # Team and player data
│   ├── matches.json         # Match results
│   ├── news.json            # Announcements
│   ├── standings.json       # Generated standings
│   ├── top_scorers.json     # Generated top scorers
│   ├── player_stats.json    # Generated player stats
│   └── bracket.json         # Knockout bracket
├── players-data.csv         # Source player data
├── import_players.py        # CSV import script
├── update_stats.py          # Statistics engine
└── deploy.bat              # Deployment automation
```

## Quick Start

### 1. Update Match Results

Edit `data/matches.json` and add/update match information:

```json
{
  "id": 7,
  "date": "2026-03-22",
  "location": "Main Stadium",
  "phase": "group",
  "team1_id": 1,
  "team2_id": 2,
  "score1": 2,
  "score2": 1,
  "goals": [
    {"member_id": 101, "minute": 23},
    {"member_id": 201, "minute": 56}
  ]
}
```

### 2. Update Statistics

Run the Python script to recalculate standings:

```bash
python update_stats.py
```

This generates:
- `data/standings.json` - Team standings
- `data/top_scorers.json` - Top goal scorers
- `data/player_stats.json` - Player statistics
- `data/bracket.json` - Knockout bracket

### 3. Deploy to GitHub Pages

#### Quick Deploy (Windows):
```bash
deploy.bat
```

#### Manual Deploy:
```bash
git add .
git commit -m "Update tournament stats"
git push
```

GitHub Pages will automatically update within seconds!

## Updating Players

### From CSV File:

1. Edit `players-data.csv`
2. Run: `python import_players.py`
3. This updates `data/teams.json`

### CSV Format:

```csv
שם קבוצה,שם,משפחה,כינוי,מספר
Team Name,First,Last,Nickname,10
```

## Tournament Phases

### Group Stage
- Round-robin matches
- 3 points for win, 1 for draw
- Teams ranked by points, then goal difference

### Knockout Stage
- Top seeds vs bottom seeds (1v8, 2v7, 3v6, 4v5)
- Winners bracket → Championship
- Losers bracket → 5th-8th place

## Color Scheme

- **Primary**: #2A6B11 (Dark Green)
- **Secondary**: #FFFF00 (Bright Yellow)

## GitHub Pages Setup

1. Go to repository Settings → Pages
2. Source: Deploy from branch `main`
3. Folder: `/ (root)`
4. Save and wait for deployment
5. Visit: `https://[username].github.io/ramadan-tournament`

## Local Testing

### Option 1: Direct File
Simply open `index.html` in your browser

### Option 2: Local Server
```bash
python -m http.server 8000
```
Then visit: `http://localhost:8000`

## Add News Announcements

Edit `data/news.json`:

```json
{
  "id": 4,
  "title": "Semifinals This Weekend!",
  "message": "Don't miss the knockout stage matches",
  "date": "2026-03-25",
  "priority": "high"
}
```

High priority news appears in the yellow banner.

## Technologies Used

- **Frontend**: HTML5, Bootstrap 5, JavaScript
- **Data Processing**: Python 3
- **Data Tables**: DataTables.js
- **Hosting**: GitHub Pages
- **Fonts**: Google Fonts (Roboto)

## Requirements

- Python 3.7+ (for statistics engine)
- Git (for deployment)
- Modern web browser

## Support

For issues or questions, check the match data format in `data/matches.json` and ensure all team IDs match those in `data/teams.json`.

---

**Tournament Status**: Group Stage  
**Last Updated**: 2026-03-19  
**Total Players**: 54  
**Total Teams**: 5
