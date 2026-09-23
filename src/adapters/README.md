# Scientific adapters

Adapters implement `ScientificAdapter` and never invent scientific payloads.

## Live

- **RCSB** (`src/adapters/rcsb/`)
- **InterPro** (`src/adapters/interpro/`) — UniProt accession lookup
- **Foldseek** (`src/adapters/foldseek/`) — Search Server ticket + result

## Import-only curriculum tools

SPRITE, BLAST, CLEAN, Dali, SwissDock — see `docs/PHASE4.md` verification notes.
Import scaffolding: `src/adapters/import/`.

## Infrastructure

Jobs, cache, provenance, stubs, shared `fetch.ts` (404/204 → NOT_FOUND).
