# Ramadan Tournament — Product Context

## Register

**product** — Tournament management app UI (public data pages, registration, admin). Marketing/legal pages use the same shell tokens but are secondary surfaces.

## Users & Purpose

- **Spectators & community** (Kfar Kama / Adygea summer football): follow standings, schedule, teams, MVPs during match windows.
- **Players & captains**: claim profiles, join teams, manage squad roles, upload photos.
- **Platform admins**: matches, roster, news, registration workflows.

Primary job: **see live tournament state quickly** in Hebrew RTL on mobile and desktop.

## Brand personality

Community, local pride, energetic but trustworthy — **not** generic SaaS sports template.

## Anti-references

- Purple/blue AI gradients, cream body defaults, identical icon+heading card grids
- Decorative motion without state meaning
- White text on light cream banners (contrast failures)

## Strategic principles

1. **IS 5568 / WCAG 2.1 AA** — legal requirement; contrast, keyboard, labels non-negotiable.
2. **Task-first product UI** — earned familiarity over decoration; motion conveys state only.
3. **Three tournament themes** — boys (green/gold), girls (rose/lavender), World Cup (navy/gold) via `data-tournament`; shared components repaint through `--color-*` tokens.
4. **Hebrew RTL** - `lang="he"`, `dir="rtl"`, Jerusalem timezone for matches.
5. **No em dashes** - never `—` in user-facing copy (UI, SEO, emails, errors). Prefer period, colon, or line break. Empty cells: ASCII `-` via `displayOrDash` (`shared/emptyDisplay.ts`). En dashes in ranges (`1–7`) are fine.

## Key surfaces

| Surface | Routes |
|---------|--------|
| Public data | `/`, `/teams`, `/schedule`, `/stats`, `/mvps`, `/archive` |
| Girls | `/girls`, `/teams-girls`, `/news-girls`, `/archive-girls` |
| World Cup | `/world-cup/*` (flag-gated) |
| Identity | `/profile`, `/login`, `/player-zone` |
| Admin | `/admin` |
| Legal | `/about`, `/privacy`, `/terms`, `/accessibility` |

## Tech constraints

- React 19 + Vite + Bootstrap 5 (CDN) + vanilla CSS tokens — no Tailwind migration.
- Design tokens: `client/src/styles/tokens.css` + theme overrides.
