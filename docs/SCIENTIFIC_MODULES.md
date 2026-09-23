# Scientific Modules

Phase 1–3 do not claim live scientific-service integrations beyond RCSB.

## Live

- **RCSB PDB Data API** — used by Protein / PDB Setup (Phase 2)

## Placeholders / stubs (Phase 3)

The following tools are registered with stub adapters that throw
`ScientificAdapterNotImplementedError`, plus optional import scaffolding:

- SPRITE
- BLAST
- InterPro
- CLEAN
- Dali
- Foldseek
- SwissDock

No API endpoints have been invented for them.

Before Phase 4 implements any adapter, the current legitimate mechanism must be
verified (endpoint, auth, rate limits, terms, automation allowed). If
verification fails, use the structured import workflow instead of fabricated
results.
