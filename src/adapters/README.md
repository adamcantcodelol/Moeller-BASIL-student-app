# Scientific adapters

Phase 1 defines the `ScientificAdapter` TypeScript contract only.

There are **no live integrations** for SPRITE, BLAST, InterPro, CLEAN, Dali,
Foldseek, SwissDock, RCSB, or any other scientific service.

Unimplemented adapters throw `ScientificAdapterNotImplementedError` and must
never return fabricated scientific payloads.
