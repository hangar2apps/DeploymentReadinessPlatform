# Backend — Readiness + Commander Data Chat

Name: ___________

Read first: `team/TEAM_PLAN.md`. Build details: `CLAUDE_CODE_BUILD.md`.
You build on the Express foundation from `backend-foundation-rag`.

## You own

The read/rollup side that powers the commander dashboard, plus the natural-
language data chat (the demo "wow" moment).

### Endpoints
```
GET  /api/units                          hierarchy (battalion -> companies)
GET  /api/units/:id                       detail + readiness stats
GET  /api/readiness?unit_id=              rollup for a unit + its children
GET  /api/readiness/trend?unit_id=&days=90  time series for the chart
GET  /api/red-flags/summary?unit_id=      aggregated issues by category
POST /api/commander/chat                  { question, unit_id } -> { answer }
```

### Readiness rollup shape (coordinate with Bryan)
```jsonc
{
  "unit_id": "...", "total_assigned": 90,
  "deployable_count": 78, "non_deployable_count": 12,
  "pct_deployable": 86.7, "delta_from_last_week": -4.3,
  "pdhra_compliance_pct": 0.0,
  "by_company": [ { "unit_id","short_name","assigned","deployable","pct" } ]
}
```
Computed from `service_members.deployable` joined to `units` (self-referencing
hierarchy via `parent_unit_id`). `red-flags/summary` groups by the
`deployable_reason` category + counts soldiers + lists affected units.

> `delta_from_last_week` / trend: there's no historical snapshot table seeded.
> For the demo, derive a plausible series (e.g. anchor today's real number and
> synthesize prior points) or seed a small `readiness_snapshots`-style set.
> Keep it honest in the pitch — it's demo data.

### Commander data chat (HIPAA-critical)
Flow: parse question -> run SQL against readiness data -> format results as
structured context -> send context + question to the LLM (GPT-4o-mini) ->
return a natural-language summary. **No embeddings** — this is not the RAG
policy assistant.

**HIPAA system prompt must instruct:** *"Summarize by category and count. Do
not include individual names, specific diagnoses, or personal medical details.
The audience is a commander who sees deployability status, not clinical
information."* So: "6 soldiers in Bravo are non-deployable due to Dental Class
3" — never "SPC Bailey has untreated cavities."

Example queries to support: "Why is Bravo at 78%?", "How many pending dental?",
"Which companies have the most non-deployable?", "Give me a CUB brief summary."

## Demo data you're working with
Battalion 86.7% deployable, Bravo 68.4%. Bravo non-deployable drivers: dental
(3) + behavioral health (2) + pregnancy (1). This is the drill-down story.

## Gotchas
- Vanilla Postgres only (portability). Parameterized SQL.
- OPENAI_API_KEY is in the gateway's root `.env`.
- Keep the data-chat prompt's PHI guardrail explicit — judges will ask about it.
