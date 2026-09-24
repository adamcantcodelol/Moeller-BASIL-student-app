# Phase 4 — Scientific modules

## Live adapters

| Tool | Mechanism | Worker fit |
| --- | --- | --- |
| **InterPro REST** | Sync GET by UniProt accession | Excellent |
| **Foldseek Search API** | POST ticket + short poll (`search.foldseek.com/api`) | Good (browser polls Worker) |
| **SPRITE (GrAfSS)** | POST upload + poll session + results (`grafss.ukm.my/api/sprite`) | Good (Worker egress; browser only talks to our Worker) |
| **RCSB** (Phase 2) | Sync REST | Excellent |

## Import-only (verified)

| Tool | Why not live in Workers |
| --- | --- |
| **BLAST** | NCBI async RID poll ≥60s |
| **CLEAN** | Live Worker adapter (UIUC MoleculeMaker API, health-checked; "unavailable" + Retry when its result storage is down) — see SCIENTIFIC_MODULES.md |
| **Dali** | Web-form oriented; no adopted free REST submit API |
| **SwissDock** | Free multi-step API but long-running (minutes) |

SPRITE import remains an **optional fallback** when live GrAfSS is down. Import modules store **raw** student exports with `source: "import"` and never invent hits.

## SPRITE live flow (school-safe)

1. Student clicks **Run SPRITE** on `moeller-basil.workers.dev` only.
2. Worker `POST https://grafss.ukm.my/api/sprite/upload` (`sprite_db`, `query_pdbid`).
3. Worker polls `GET .../session_data/{session_id}` until `structures[0].celery.state === "COMPLETED"`.
4. Worker fetches `GET .../results/{session_id}/{struc_id}` and persists raw + normalized results with provenance source `https://grafss.ukm.my`.
5. Students do **not** need grafss.ukm.my on the school allowlist; Cloudflare Worker egress must reach it.

Default database: **csa3** (CSA, exclude 2-residue). Optional UI select: `all3`, `m-csa3`, `csa32`, `m-csa32`.

## Endpoints

- InterPro: `GET/POST/PATCH /api/projects/:id/modules/interpro` (+ `/import`)
- Foldseek: `GET/POST/PATCH /api/projects/:id/modules/foldseek` (+ `/poll`, shared `/import`)
- SPRITE: `GET/POST/PATCH /api/projects/:id/modules/sprite` (+ `/poll`, shared `/import`)
- Import tools: `POST /api/projects/:id/modules/:slug/import` + `PATCH .../:slug`

## Integrity

- Failures surface clear errors
- Cache used for InterPro responses
- Foldseek / SPRITE pending tickets are polled; no fabricated alignments
- Jobs: `queued` / `running` / `succeeded` / `failed` in D1

## Gates

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
