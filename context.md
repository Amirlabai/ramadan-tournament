# Project Context: Ramadan Tournament

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Bootstrap 5.
- **Backend**: Node.js, Express, MongoDB (Mongoose), TypeScript.
- **Data**: JSON and JS files in `data/` directory for static/hydrated data.
- **DevOps**: Render (Backend), Vercel (Frontend), GitHub Actions (Automation).

## Architecture
- **Monorepo**: contains both `client`, `server`, and root-level automation scripts.
- **Data Layer**: Uses a hybrid approach with MongoDB for dynamic content (matches, news, stats) and static files in `data/` for some reference datasets.
- **Automation**: Core tournament automation (stats calculations, AI summarizations, CSV imports) is handled natively within the Node.js API processes. Python remains strictly for specific peripheral tasks such as syncing photos (`sync_photos.py`) and fetching external alarm data periodically (`fetch_alarms.py`).

## Current Focus
- Enhancing tournament management features for Ramadan 2026.
- Adding real-time or automated data feeds (e.g., Alarms data every two hours) for user safety and information.
- **Bug Fix Needed:** Phone view has a total horizontal scroll issue that needs to be fixed.
- **Archive System**: Managing historical records via `SeasonArchive` model and `archive-season.ts` automation.

## Recent Changes
- **Career Documentation**: Updated `resume.md` to showcase the Ramadan Tournament project as a premier full-stack achievement, highlighting MERN stack mastery, AI integration (Gemini), and advanced RTL/security implementations.
- Consolidated Admin mappings, registrations, and player management into a unified Roster view.
- Added `bio` field to Player records and user profile editing flow.
- Implemented real-time Avatar synchronization to official Team records.
- Refactored player profile data flow (backend hydration maps directly from Team database).
- Aligned UI button and table styles between user mapping panels and matches management.
- **Database Integrity**: Fixed cross-team `memberId` collisions and implemented global ID generation.
- **Navigation**: Implemented session-aware links in the footer and extended smart polling to all main data pages (Teams, Stats, Schedule, Dashboard). Fixed expanded team scrolling in `Teams.tsx` using top-aligned manual calculation (100px offset). Improved Iftar widget visibility with `z-index: 2000` and removed programmatic sticky tabs behavior to resolve mobile horizontal scroll issues.
- **UI Enhancements**: Added a centered `top-scorer.svg` badge above the 1st place scorer in `MVPs.tsx` with a refined 5px spacing.
- **Voting Reliability**: Resolved a race condition where voting status was checked before auth state was ready; implemented `authLoading` synchronization in `MVPs.tsx` and `Teams.tsx`.
- **Security & Registration**: Built an Email Verification (OTP) system. New registrants must verify a 6-digit code sent via SMTP to activate their accounts. `Login.tsx` now handles the verification flow and blocks unverified logins.
- **Playoff Automation**: Implemented automated knockout schedule generation. Admins can sync playoff matchups from the Admin Panel based on current standings, automatically creating semi-finals for March 17th and final placeholders for March 18th.
- **Stats Automation**: Migrated from GitHub Actions to a server-side `AutomationService`. Admins can manually trigger a news update via the Admin Panel, which calculates stats, detects changes via `stats_snapshots`, and generates an AI summary in Hebrew using Gemini 1.5 Flash.
- Implementation of photo approval system.
- Match time support with Jerusalem timezone.
- Iftar countdown timer widget.
- UI refinements with mirrored foregrounds and Adygea flag.
- Fixed 404 error on `/api/stats` endpoint.
- Clarified Admin authentication flow for external tools.
- **CSS Cleanup**: Removed stale match styles from `index.css`. Scoped conflicting class names in `Dashboard.css` under `.dashboard-page` parent, and `.team-name` in `Stats.css` under `.stats-page`, to prevent global CSS bleed in Vite's bundled output.
- **Bug Fix**: Resolved syntax error in `Teams.tsx` (identifier following numeric literal).
- **Bug Fix**: Fixed a syntax error in `IftarTimer.css` and removed a global `pointer-events: auto` wildcard selector in both widget CSS files that was causing mobile UI (like navigation tabs) to be unclickable when the widgets were minimized.
- **Bug Fix**: Fixed moon illumination percentage staying identical across days; `IftarTimer` now computes fractional days for real-time moon phase tracking.
- **Polling Refinement**: Restricted smart polling logic (30s background refresh) to a strict 20:00–23:59 tournament window across Dashboard, Teams, and Stats pages. Added a logic guard in `Dashboard.tsx` to ensure polling ONLY occurs on days when matches are actually scheduled, preventing wasteful pings during the off-season or early morning hours.
- **SEO & Accessibility**: Implemented a comprehensive SEO engine using `react-helmet-async`. Every main view (Dashboard, Teams, Schedule, Stats, Player Zone) now has unique, localized metadata, Open Graph tags, and canonical links. Updated `sitemap.xml` and `robots.txt`. Added descriptive `alt` tags to branding images for improved accessibility and search indexing.
- **Archive UI Polish & Data Fixes (Mar 2026)**:
  - Harmonized Archive styling with the rest of the application using standard project CSS variables.
  - Fixed data mapping mismatches (e.g., `wins` vs `won`) in the historical standings table.
  - Relocated top scorers to a full-width table and converted knockout matches to card format for consistency.
- **Model Integrity**: Resolved Mongoose schema type conflicts in `SeasonArchive.ts` by relaxing mixed-field interfaces.
- **Post-Ramadan Cleanup**: Transitioned the Iftar countdown widget to an inactive state in `App.tsx`.
