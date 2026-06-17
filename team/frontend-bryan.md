# Bryan — Frontend (App Shell + Commander) + Contract Steward

Read first: `team/TEAM_PLAN.md`. Product context: `DRP_SPEC.md`.
Design direction: `CLAUDE_CODE_BUILD.md` §Design Direction + `drp_mockups.html`.

## Your lanes

### 1. App shell + design system (Day 1 AM — unblocks Derrick)
- React Router with three routes: `/assessment`, `/provider`, `/commander`.
- **Mock auth / role switcher** (top of app): Service Member / Provider /
  Commander. Pre-selects a seeded person per role (SPC Rodriguez / CPT Chen /
  LTC Harris). Store in localStorage. No real auth.
- **Design system** from the mockups into the Tailwind config: colors
  (dark bg `#0e1613`, accent `#c5d64a`, ok `#4ade80`, warn `#fbbf24`,
  danger `#f87171`), fonts (Sora body, JetBrains Mono data/labels).
- Reusable components: KPI card, status badge, severity flag badge
  (red=HIGH/yellow=MEDIUM/blue=LOW/green=NONE), data table, sidebar layout.
- CUI bar across the top: "CUI // CONTROLLED UNCLASSIFIED INFORMATION //
  DEMO — NOT ACTUAL PHI".

### 2. Commander dashboard (`/commander`)
- KPI cards: % deployable (w/ delta), total assigned, non-deployable count,
  PDHRA compliance %.
- Readiness by company: bar per company, color by threshold
  (green >90 / yellow 80-90 / red <80), click to drill into roster.
- Attention Required: issues by category w/ counts + affected units.
- 90-day trend chart (line + area fill).
- Deployment window tracker + "EXPORT CUB BRIEF" button.
- **PDF export = client-side** (e.g. jsPDF / react-to-print) from dashboard data.
- **Commander data-chat panel**: posts to `POST /api/commander/chat`, renders
  the natural-language summary. This is the demo "wow" moment.

### 3. Contract steward / bridge
- Run the Day 1 kickoff: brief the data model + seed data to the unicorns.
- Own the API contract in `TEAM_PLAN.md`; changes route through you.

## APIs you consume
```
GET  /api/readiness?unit_id=          (backend-readiness-chat)
GET  /api/readiness/trend?unit_id=&days=90
GET  /api/red-flags/summary?unit_id=
GET  /api/service-members?unit_id=&deployable=false   (roster drill-down)
POST /api/commander/chat   { question, unit_id } -> { answer }
```

## Demo targets baked into seed data
- Battalion ~87% deployable; **Bravo ~68%** — your drill-down moment.
- "Why did Bravo drop?" -> data chat explains dental + behavioral health.

## Gotchas
- Frontend dev server is :5173; gateway is :3000 (CORS already allows :5173).
- You scaffolded frontend (Vite + React + TS + Tailwind v4) — it runs.
- Don't block on backend: build against the contract, mock responses early.
