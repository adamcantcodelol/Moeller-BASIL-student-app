# Phase 4 — Scientific modules

## Live adapters

| Tool | Mechanism | Worker fit |
| --- | --- | --- |
| **InterPro REST** | Sync GET by UniProt accession | Excellent |
| **Foldseek Search API** | POST ticket + short poll (`search.foldseek.com/api`) | Good (browser polls Worker) |
| **RCSB** (Phase 2) | Sync REST | Excellent |

## Import-only (verified)

| Tool | Why not live in Workers |
| --- | --- |
| **BLAST** | NCBI async RID poll ≥60s |
| **SPRITE** | No verified free public API |
| **CLEAN** | No verified Worker-ready free automation claimed |
| **Dali** | Web-form oriented; no adopted free REST submit API |
| **SwissDock** | Free multi-step API but long-running (minutes) |

Import modules store **raw** student exports with `source: "import"` and never invent hits.

## Endpoints

- InterPro: `GET/POST/PATCH /api/projects/:id/modules/interpro` (+ `/import`)
- Foldseek: `GET/POST/PATCH /api/projects/:id/modules/foldseek` (+ `/poll`, shared `/import`)
- Import tools: `POST /api/projects/:id/modules/:slug/import` + `PATCH .../:slug`

## Integrity

- Failures surface clear errors
- Cache used for InterPro responses
- Foldseek pending tickets are polled; no fabricated alignments
- **No deploy** until John says so

## Gates

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
