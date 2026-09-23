# Scientific adapters

Adapters implement `ScientificAdapter` and never invent scientific payloads.

## Live

- **RCSB** (`src/adapters/rcsb/`)
- **InterPro** (`src/adapters/interpro/`) — UniProt accession lookup
- **Foldseek** (`src/adapters/foldseek/`) — Search Server ticket + result
- **SPRITE** (`src/adapters/sprite/`) — GrAfSS upload + session poll + results (`grafss.ukm.my`)

## Import-only curriculum tools

BLAST, CLEAN, Dali, SwissDock — see `docs/PHASE4.md` verification notes.
SPRITE also keeps an optional import fallback when live GrAfSS is down.
Import scaffolding: `src/adapters/import/`.

## Infrastructure

Jobs, cache, provenance, stubs, shared `fetch.ts` (404/204 → NOT_FOUND).
