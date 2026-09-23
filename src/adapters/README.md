# Scientific adapters

Adapters implement `ScientificAdapter` and never invent scientific payloads.

## Implemented (live)

- **RCSB PDB Data API** (`src/adapters/rcsb/`) — entry + polymer entity
  metadata for Phase 2 PDB Setup. Free public REST endpoints under
  `https://data.rcsb.org/rest/v1/core/`. Uses shared `fetchJsonWithTimeout`.

## Infrastructure (Phase 3)

- `scientificAdapter.ts` — interface + not-implemented factory
- `errors.ts` / `fetch.ts` — shared errors and timed JSON GET
- `registry.ts` — tool registration (live vs stub vs import)
- `stubs/` — explicit stubs that throw `ScientificAdapterNotImplementedError`
- `import/` — import workflow definitions + raw import storage
- Jobs: `src/lib/jobs/scientificJobService.ts`
- Cache: `src/lib/cache/adapterCache.ts`
- Provenance: `src/lib/provenance/buildProvenance.ts`

## Not implemented (do not claim)

SPRITE, BLAST, InterPro, CLEAN, Dali, Foldseek, SwissDock.

Unimplemented adapters must throw `ScientificAdapterNotImplementedError` rather
than returning fabricated results. Import scaffolding may store **raw** student
files with provenance `source: "import"` after format validation only.
