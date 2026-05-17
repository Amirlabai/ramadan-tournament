# Review: IS 5568 / WCAG 2.1 AA pass (May 2026)

> **Standard:** Israeli Standard ת"י 5568 (= WCAG 2.1 Level AA). All follow-up UI edits must satisfy this standard.  
> **Agent rule:** [.cursor/rules/israeli-accessibility-is5568.mdc](../.cursor/rules/israeli-accessibility-is5568.mdc)  
> **Tracking:** [status.md](../status.md) · [context.md](../context.md#accessibility-israeli-standard-is-5568)

| Field | Value |
|-------|--------|
| **Status** | Open — deploy coordinator name/phone; manual verify |
| **Date** | 2026-05-17 |
| **Style** | caveman-review |

**Scope:** ~26 files + `AccessibleModal`, `useFocusTrap`, `/accessibility` route.

---

## Resolved (2026-05-17)

| Item | Fix |
|------|-----|
| Teams nested vote + card | Separate `<button>` for vote and card open |
| MVPs click-only rows | Premium, runner-up, MVP rows use `<button>` |
| `useFocusTrap` | `onEscape` stored in ref |
| `AccessibleModal` | Body scroll lock + `inert` on `.app` |
| `PlayerClaimModal` | Uses `AccessibleModal` |
| NewsBanner | Panel sibling to toggle; `hidden` / `aria-hidden` when collapsed |
| AlarmsWidget | Click-only popover (no hover-only open) |
| `index.css` | Removed global `p + p`; removed `.alert-*::before` |
| Archive | `scope="col"` on all `<th>`; `type="button"` on season buttons |
| Schedule / Dashboard | Already `<button>`; added `type="button"` / `aria-expanded` where needed |

---

## Still open

`client/src/pages/Accessibility.tsx` — ship blocker: real coordinator email and contact details (placeholders).

`package-lock.json` — nit: unrelated `peer` flag churn; keep out of a11y-only commits if possible.

---

## Good

Skip link + `#main-content`, semantic `<nav>`, `aria-current`, table captions, form labels, focus rings, reduced motion, shared modal primitive, AlarmsWidget buttons, contrast token bump.

---

## Before claiming AA

Run verification checklist in [status.md](../status.md) (Lighthouse, keyboard-only, screen reader, contrast, zoom).

---

## Follow-up review — pass 2 (2026-05-17)

Re-review of current diff. Prior pass items largely fixed; new findings below.

### Resolved (pass 2 fixes, 2026-05-17)

| Item | Fix |
|------|-----|
| `AccessibleModal` inert | Portal to `document.body`; `inert` on `.app` only |
| Email mismatch | Single `COORDINATOR_EMAIL` constant for mailto + display |
| `MVPs` `resolveTeamId` | Returns `null`; MVP row `disabled` when unknown |
| Dashboard comments | `type="button"`, `aria-expanded` |
| Login success | `role="alert"` on success messages |
| Modal backdrop | Decorative layer `aria-hidden="true"` |
| Teams top scorer | `aria-label` on ⚽ badge |
| NewsBanner scroll | Removed auto-collapse on scroll; removed `aria-live` |

### Still open

`Accessibility.tsx` — coordinator name/phone placeholders (`FAAFO`, `0501234567`); replace at deploy via `COORDINATOR_*` constants.

### Nit

`AdminPanel.tsx:L309,L317-352` — 🔵 nit: admin tab bar not `role="tablist"` / `aria-selected`; mirror public `Navbar` pattern.

`Profile.tsx` + scattered admin buttons — 🔵 nit: many `<button>` without `type="button"`; add for form-adjacent pages.

`package-lock.json` — 🔵 nit: unrelated `peer` churn; split from a11y commit.

`review/` vs `Review/` — 🔵 nit: folder casing inconsistent on case-sensitive CI/fs.

### Pass 2 — no re-flag

Teams vote/card split, MVPs `<button>` rows, `useFocusTrap` ref, `PlayerClaimModal` → `AccessibleModal`, NewsBanner panel sibling + `hidden`, Alarms click-only, Archive `scope` + season buttons, Schedule filters/buttons, global `p+p` / alert `::before` removed.

### Pass 2 verdict

Code blockers addressed. Not AA-ready until real coordinator name/phone at deploy and manual checklist (keyboard, SR, contrast, zoom).
