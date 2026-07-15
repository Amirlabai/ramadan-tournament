---
target: staged browse UI neo-brutal-browse + match cards
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-15T21-03-21Z
slug: client-src-styles-neo-brutal-browse-css
---
Method: dual-agent (A: 5abe61ea-fa25-4e1f-b749-e488abad2054 · B: c6c91540-3bcd-4452-8d85-ce5b674e69d3)

Target: staged browse UI (`neo-brutal-browse.css`, match cards, Dashboard/Schedule)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + badges good; expanded finished match shows bare “אין סטטיסטיקה זמינה” |
| 2 | Match System / Real World | 3 | Hebrew sports voice solid; face “סיכוי לניצחון” reads tipster-like without framing |
| 3 | User Control and Freedom | 3 | Filters + expand work; recent-match nav jumps to filter only, not match |
| 4 | Consistency and Standards | 1 | 6px L-accents violate DESIGN.md; match-card top-border fights browse L-frame; WC chrome still boys-green |
| 5 | Error Prevention | 2 | Soft fail on win-chance; “הכל” dumps scorers + 20 upcoming |
| 6 | Recognition Rather Than Recall | 3 | Status labeled; win-chance sides are color/% only (bar `aria-hidden`) |
| 7 | Flexibility and Efficiency | 2 | No filter accelerators; no collapse-all; dashboard deep-link gap |
| 8 | Aesthetic and Minimalist Design | 1 | Equal-weight L-borders; nested dashboard cards; status×3 (badge+tint+accent) |
| 9 | Error Recovery | 2 | Generic page errors; empty stats not actionable |
| 10 | Help and Documentation | 2 | Skip link + accessibility page; AI caveat only inside expanded stats, not on face win-chance |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** The site still feels locally authentic (header collage, Hebrew copy, tournament update). The *card system* is the AI tell: identical 6px inline-start + bottom L-frames stamped on section shells and every status match card. That reintroduces a DESIGN.md Don’t and the Impeccable side-stripe ban while claiming “admin workflow-queue” continuity. Nested bordered trays of bordered match cards compound the slop. No gradient text on cards; the main tells are side accents + nested cards + uniform accent weight.

**Deterministic scan:**
- CLI `pages/`: **71** findings (exit 2) — mostly `design-system-color` advisories; **2** `side-tab` warnings in `Dashboard.css:516` (3px) and `Stats.css:67` (playoff row). Match/standings components clean (exit 0). Skeleton: 5 radius advisories.
- Manual grep (styles not in markup scan): `neo-brutal-browse.css` sets `--browse-card-accent-w: 6px` with `border-inline-start-width` at 10 sites (L26, 72, 80, 88, 96, 138, 177, 203, 238, 259). `match-card.css` clean of side accents.
- Live inject (`/`, `/schedule`, `/stats`, `/teams`, `/mvps`): mostly chrome `low-contrast` (white/gold on `#509238`), font monoculture, heading skip, glow/gradient in chrome — **no live `side-tab` hits** because inject sees computed chrome, while the 6px accents live in CSS the detector’s markup pass missed.
- **Agreement:** A’s P0 L-accent finds strong support from manual ban grep; CLI `side-tab` only caught older 3px rules, under-reporting the staged 6px system (false negative on `styles/`).
- **False positives:** overused/single-font, footer heading skip, admin color advisories, header contrast noise.

**Visual overlays:** Live detect.js injected on five routes; console findings captured. Overlays were injected into the automation tab — treat browser console counts above as the reliable signal if no [Human]-labeled overlay tab remains open.

## Overall Impression

A credible community tournament shell got dressed in ops-queue chrome. Status tint and shared match primitives are the right direction; the thick L-frame and nested cards erase hierarchy and violate the project’s own design law. Biggest opportunity: strip accent thickness, one border layer on dashboard, keep badge + tint.

## What's Working

1. **Product voice & a11y scaffolding** — Hebrew RTL, skip link, filter `aria-pressed`, focus-visible on card links, high-contrast control.
2. **Shared match primitives** — `MatchCardParts`, `MatchCommentsToggle`, lazy `UpcomingWinChance` (IntersectionObserver): coherent face → expand model.
3. **Restraint on shadows** — Dropping neo-brutal black shadows is correct; tint + badge could carry status without 6px accents.

## Priority Issues

### P0 — Thick side/L accent reintroduced as the system
- **What:** `--browse-card-accent-w: 6px` with `border-inline-start` (+ bottom) on match cards, dashboard shells, stats/team browse cards (`neo-brutal-browse.css`).
- **Why it matters:** Violates DESIGN.md Don’t and Impeccable absolute side-stripe ban; every box shouts “urgent”; equal visual weight.
- **Fix:** Remove accent-width overrides; uniform ≤2px full border or tint only; restore badge/top-edge status per DESIGN; align with `match-card.css`.
- **Suggested command:** `/impeccable distill` (then `/impeccable polish`)

### P1 — Nested cards on Dashboard
- **What:** Section shells (`.next-matches-card`, etc.) use the same L-frame as child `.match-card` / `.match-item`.
- **Why it matters:** Nested-card ban; hierarchy collapses into bordered trays of bordered trays.
- **Fix:** Section = flat surface or title band only; status treatment only on match rows.
- **Suggested command:** `/impeccable layout`

### P1 — Schedule “הכל” / finished face is a scorer wall
- **What:** Finished cards always show goal lists + emoji balls before expand; default “הכל” mixes finished with 20 upcoming.
- **Why it matters:** Extraneous load; kickoff scanning fails; emoji fights the new chrome.
- **Fix:** Default to upcoming (or date groups); move scorers behind `פרטים`.
- **Suggested command:** `/impeccable distill`

### P2 — Face win-chance trust and parsing
- **What:** Face `WinChanceBar` green/gold % without AI caveat; bar `aria-hidden`; many cards share similar splits.
- **Why it matters:** Undermines “trustworthy”; color↔team mapping opaque under RTL.
- **Fix:** Team labels on fills or move odds under expand; one-line “הערכה” beside caption.
- **Suggested command:** `/impeccable clarify` (or `/impeccable harden` for a11y)

### P2 — Expand empty state / dashboard deep-link gap
- **What:** “אין סטטיסטיקה זמינה” with no next step; recent matches navigate to `filter: finished` without `matchId`.
- **Why it matters:** High-intent flows end cold; power users bounce.
- **Fix:** Explain empty + link to /stats or hide region; pass `matchId` like live path.
- **Suggested command:** `/impeccable harden`

## Persona Red Flags

**Alex (Power User):** No filter keyboard shortcuts; dashboard recent rows don’t deep-link a match; cannot bulk-collapse scorers; 20× “הוסף תגובה” noise.

**Sam (Accessibility-Dependent):** Win-chance sides color/% only; live badge green-on-green under WC themes; long focus path through sidebar before content.

**Casey (Distracted Mobile):** First viewport collage + news + sidebar before matches; tall amber cards with win-chance force long scroll; filters not in thumb zone.

## Minor Observations

- Filename/header of `neo-brutal-browse.css` documents the banned thick accent while denying black shadows.
- Technical-match muted borders are a better hierarchy exemplar than upcoming amber shout.
- Top-scorer ★ decoration feels leftover vs flat browse cards.
- `data-tournament` appeared unset on `documentElement` while WC branding showed — theme wiring murky for navy/gold.
- Live inject low-contrast on green header (white ~3.8:1 on `#509238`) is chrome debt, mostly outside this stage’s browse cards — still IS 5568-relevant.
- CLI `side-tab` under-reports because scan skipped `styles/`.

## Questions to Consider

1. If admin workflow-queue chrome is the reference, why is that the spectator language — shouldn’t browse feel like stands energy, not ops queue?
2. Would removing every thick accent (tint + badge only) still read as “redesign,” or was accent thickness carrying most of the perceived change?
3. Is face-level win% earning trust for כפר כמא, or teaching that the product is a tipster site?
4. For World Cup, if users can’t feel navy/gold in browse cards, is the redesign theme-aware or only boys-green-skinned?

## Cognitive load

**5/8 checklist failures → high.** Failed: single focus, chunking, visual hierarchy, one thing at a time, progressive disclosure. Passed: grouping, working memory (mostly), filter choice count (≤4).

## Emotional journey

Open peak (local header/update) → skeleton valley (loud orange frames) → manufactured identical upcoming cards valley → micro-peak on expand filters → empty-stats cold end.
