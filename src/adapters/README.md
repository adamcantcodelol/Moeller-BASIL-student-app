# Scientific adapters

Adapters implement `ScientificAdapter` and never invent scientific payloads.

## Implemented

- **RCSB PDB Data API** (`src/adapters/rcsb/`) — entry + polymer entity
  metadata for Phase 2 PDB Setup. Free public REST endpoints under
  `https://data.rcsb.org/rest/v1/core/`.

## Not implemented

SPRITE, BLAST, InterPro, CLEAN, Dali, Foldseek, SwissDock, and any other
scientific service. Unimplemented adapters must throw
`ScientificAdapterNotImplementedError` rather than returning fabricated
results.
