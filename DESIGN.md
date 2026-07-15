---
name: Ramadan Tournament
description: Hebrew RTL community football tournament — Adygea green and gold
colors:
  primary: "#509238"
  primary-dark: "#296912"
  secondary: "#ffae00"
  gold: "#ffd700"
  gold-dark: "#b8860b"
  highlight-bg-start: "#fff8dc"
  highlight-bg-end: "#ffe4b5"
  gold-light: "#ffe285"
  bg: "#F5F5F5"
  surface: "#ffffff"
  text: "#333333"
  text-muted: "#4b5563"
  border: "#E0E0E0"
  focus: "#0066cc"
typography:
  body:
    fontFamily: "Roboto, Segoe UI, Tahoma, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  display:
    fontFamily: "Roboto, Segoe UI, Tahoma, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
  bracket:
    fontFamily: "Outfit, Roboto, sans-serif"
    fontWeight: 700
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  card-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

## Overview

Product UI for a Hebrew RTL tournament site. Boys theme is default (`data-tournament="boys"`). Girls and World Cup override `--color-*` primitives in `tournament-girls.css` and `tournament-worldcup.css`. Layout: header + optional news banner, main content + sticky right sidebar (RTL), footer.

**Accessibility:** IS 5568 / WCAG 2.1 AA. Minimum contrast 4.5:1 body text. Use `AccessibleModal`, skeleton loaders with `role="status"`, visible `:focus-visible`.

## Colors

- **Primary green** `#509238` — actions, nav active, card headers (solid, not gradient).
- **Primary dark** `#296912` — hover/pressed header tones.
- **Secondary gold** `#ffae00` — accents, live match emphasis, playoff badges.
- **Gold tokens** `--color-gold`, `--color-gold-dark` — medals, top scorer, playoff chips (never raw `#FFD700` in components).
- **Highlight cream** `--color-highlight-bg-start/end` — news banner background only; text must be `--color-text` (dark), never white on cream.
- **Semantic:** `--color-danger`, `--color-warning`, `--color-playoff-zone-bg` for standings playoff zone.

Girls: rose `#9b4d72`, lavender accent. World Cup: navy `#1a3a6e`, gold `#c9a227`.

## Typography

- **Body:** Roboto 400/700 — UI labels, tables, forms.
- **Site title:** `.site-title` / `.tournament-page-title` — fixed rem scale, not Bootstrap `display-4`.
- **Bracket:** Outfit — playoff bracket only.
- **Data:** `font-variant-numeric: tabular-nums` on scores, standings, dates.
- **Do not load Inter** — unused third font.

## Elevation

- Cards: `box-shadow: 0 2px 8px rgba(0,0,0,0.08)` or `--shadow`.
- Primary-tinted shadows: `--shadow-primary-sm/md`.
- Flat card headers preferred over gradient title bars.

## Components

- **`.dashboard-card-title`** — solid `--color-primary` background, white text, centered.
- **`.match-card`** — status via badge + tinted fill + **L-frame** (2px border, 6px inline-start + bottom accent) from [`neo-brutal-browse.css`](client/src/styles/neo-brutal-browse.css); shared `match-card.css` for inner layout.
- **Browse L-frame** — intentional product language (aligned with admin workflow-queue cards). Use on match cards, team/news browse cards, and standalone section shells that do **not** nest other L-framed cards. Nested tray + card both with L is wrong: outer shell stays flat 2px; L stays on the inner match rows/cards.
- **`.standings-table`** — responsive table with `caption`, `scope`, playoff row class `qualified`.
- **`.tournament-sidebar-link.active`** — primary color + subtle bg + start border.
- **Claim banners** — tinted border, no heavy multi-stop gradients.

## Do's and Don'ts

**Do**

- Use `--color-*` tokens and tournament utility classes (`.btn-tournament-primary`, `.text-tournament-primary`).
- Keep gradients for site header/footer only.
- Respect `prefers-reduced-motion` on animations.
- Use the browse L-frame (`--browse-card-accent-w`) for status-bearing cards; keep one L layer (no nested L).

**Don't**

- Gradient text (`background-clip: text`) on stats numbers.
- White text on cream news banner.
- Mix Bootstrap Icons and Font Awesome without loading both CDNs.
- Arbitrary thick side stripes outside the shared browse L-frame tokens (e.g. one-off `border-right: 4px` callouts).
- Nest an L-framed section shell around L-framed match cards — flatten the shell.
- Bootstrap `text-success` on girls pages — use `.text-tournament-primary`.
