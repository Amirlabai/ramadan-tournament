# Ramadan Tournament — Documentation

Canonical documentation for this monorepo. **If docs disagree with code, code wins** — file a doc fix.

## Hierarchy

| Layer | Location | Role |
|-------|----------|------|
| Code | `client/src`, `server/src`, `shared/`, `server/prisma/schema.prisma` | Ultimate behavior |
| **This tree** | `docs/` | Architecture, API, product intent, QA traceability |
| Session | [`context.md`](../context.md), [`status.md`](../status.md) | Overview + milestones (pointers only) |
| Agent rules | [`.cursor/rules/`](../.cursor/rules/) | Always-on / scoped conventions (a11y, mobile, **no em dashes** in product copy) |
| Quick start | Root [`README.md`](../README.md), [`client/README.md`](../client/README.md), [`server/README.md`](../server/README.md) | Setup and scripts |

## Directories

| Dir | Purpose | Audience |
|-----|---------|----------|
| [`client/`](client/) | Frontend architecture | FE devs, agents |
| [`server/`](server/) | Business logic + API reference | BE devs, agents |
| [`agent/`](agent/) | Implementation handoff | Cursor agents |
| [`product/`](product/) | PRD, schema narrative | PO, architects |
| [`review/`](review/) | QA RTM, a11y pass, World Cup reversion | QA, a11y, ops |
| [`handoff/`](handoff/) | Historical design handoffs | Reference only |

## Read order

**Frontend:** [`client/ARCHITECTURE.md`](client/ARCHITECTURE.md) → [`server/API_REFERENCE.md`](server/API_REFERENCE.md) (contracts)

**Backend:** [`server/BUSINESS_LOGIC.md`](server/BUSINESS_LOGIC.md) → [`server/API_REFERENCE.md`](server/API_REFERENCE.md)

**Stakeholders:** [`product/PRD-database-schema.md`](product/PRD-database-schema.md) → [`review/phase-2-rtm-qa-may-2026.md`](review/phase-2-rtm-qa-may-2026.md)

**Agents:** [`.cursor/agent-rtm.md`](../.cursor/agent-rtm.md) → [`agent/HANDOFF.md`](agent/HANDOFF.md)

## Related (outside `docs/`)

- Accessibility rule: [`.cursor/rules/israeli-accessibility-is5568.mdc`](../.cursor/rules/israeli-accessibility-is5568.mdc)
- New doc drops: [`.incoming/`](../.incoming/) (process into `docs/` when stable)
- Python automation: [`scripts/README.md`](../scripts/README.md)
