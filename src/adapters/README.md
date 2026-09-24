# Scientific adapters

Adapters implement `ScientificAdapter` and never invent scientific payloads.

## Live

- **RCSB** (`src/adapters/rcsb/`)
- **InterPro** (`src/adapters/interpro/`) — UniProt accession lookup
- **Foldseek** (`src/adapters/foldseek/`) — Search Server ticket + result
- **SPRITE** (`src/adapters/sprite/`) — GrAfSS upload + session poll + results (`grafss.ukm.my`)
- **CLEAN** (`src/adapters/clean/`) — UIUC MoleculeMaker `POST /clean/jobs` → `GET /clean/jobs/{id}` (phase) → `GET /clean/results/{id}` on `mmli.fastapi.mmli2.ncsa.illinois.edu`. Results-store health probe cached ~5 min; 5xx after completion retried twice ~30s apart, then "unavailable". ExPASy ENZYME names are best-effort.

## Import-only curriculum tools

BLAST, CLEAN, Dali, SwissDock keep import fallbacks — see `docs/PHASE4.md` verification notes.
SPRITE also keeps an optional import fallback when live GrAfSS is down.
Import scaffolding: `src/adapters/import/`.

## Infrastructure

Jobs, cache, provenance, stubs, shared `fetch.ts` (404/204 → NOT_FOUND).
