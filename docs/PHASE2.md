# Phase 2 — PDB Setup + Mol*

Phase 2 adds verified RCSB metadata retrieval and Mol* visualization for
module 00 (Protein / PDB Setup).

## Included

- RCSB PDB Data API adapter (`ScientificAdapter`) with timeout, 404, and
  network error handling
- Persistence of title, organism, chains, primary sequence, experimental
  method, resolution, and provenance on the project structure
- Raw + normalized `results` rows for the PDB Setup module run
- Mol* viewer (CDN build) loading coordinates from `files.rcsb.org`
- Completion requires a successful RCSB retrieval (not identifier-only)

## Explicitly excluded

- Active-site residue invention or highlighting
- Mol* Mode A/B/C overlays (need later evidence modules)
- Coordinate file archival in R2
- SPRITE, BLAST, InterPro, CLEAN, Dali, Foldseek, SwissDock
- ShannonBot and reports

## Integrity rules

- Empty metadata fields stay empty until RCSB succeeds
- Failures never substitute DEMO DATA or simulated structures
- Demo projects remain labeled **DEMO DATA** via `project.isDemo`

## Local verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
