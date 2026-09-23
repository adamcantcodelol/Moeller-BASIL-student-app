# Phase 3 — Scientific infrastructure

Phase 3 adds shared scientific-adapter infrastructure without claiming that
SPRITE, BLAST, InterPro, CLEAN, Dali, Foldseek, or SwissDock are automated.

## Included

- Shared adapter interface + `ScientificAdapterNotImplementedError`
- Shared HTTP helper (`fetchJsonWithTimeout`) with timeout / network / 404 handling
- Tool registry (`src/adapters/registry.ts`) — only RCSB is live
- Explicit stubs for unimplemented curriculum tools
- Scientific job lifecycle: `queued` → `running` → `succeeded` | `failed`, plus `awaiting_import`
- Legitimate response cache table (`adapter_response_cache`) with TTL
- Consistent provenance builders (`buildProvenance`, `buildImportProvenance`)
- Import workflow scaffolding (format validation + raw storage, source=`import`)
- D1 migration `drizzle/0003_phase3_jobs_cache.sql`

## Explicitly excluded (at Phase 3 close)

- Live BLAST / SPRITE / InterPro / CLEAN / Dali / Foldseek / SwissDock adapters
  (InterPro went live in Phase 4 — see `PHASE4.md`)
- Invented endpoints or fabricated scientific hits
- Deployment (`wrangler deploy`) — build only until John says to deploy
- Active-site synthesis, ShannonBot, reports

## Integrity rules

- Stub adapters throw rather than return simulated science
- Cache stores only real prior responses; cache miss never invents data
- Import mode stores raw student-provided content with `source: "import"`
- Demo projects remain labeled **DEMO DATA** via `project.isDemo`
- Failures mark jobs `failed` and never substitute demo / fake results

## Local verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
