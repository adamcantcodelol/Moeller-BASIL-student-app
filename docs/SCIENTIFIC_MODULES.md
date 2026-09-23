# Scientific Modules

## Live

- **RCSB PDB Data API** — Protein / PDB Setup (Phase 2)
- **InterPro REST API** — InterPro module (Phase 4): UniProt accession → domains / families / signatures with job + cache + provenance. Import fallback available when the API is flaky.

## Placeholders / stubs

The following tools remain registered with stub adapters that throw
`ScientificAdapterNotImplementedError`, plus optional import scaffolding:

- SPRITE
- BLAST (async NCBI polling unfit for Workers in Phase 4; import-only for now)
- CLEAN
- Dali
- Foldseek
- SwissDock

Before implementing any remaining adapter, verify the legitimate mechanism
(endpoint, auth, rate limits, terms, automation allowed). If verification fails,
use the structured import workflow instead of fabricated results.
