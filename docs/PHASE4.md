# Phase 4 — First live scientific module (InterPro)

Phase 4 wires the first curriculum scientific tool beyond RCSB using Phase 3
jobs, cache, and provenance.

## Tool selection

**Chosen: InterPro REST API** (EMBL-EBI)

| Candidate | Auth | Worker fit | Notes |
| --- | --- | --- | --- |
| **InterPro REST** | None | Excellent (sync GET) | Free public API at `https://www.ebi.ac.uk/interpro/api/` |
| NCBI BLAST URL API | email+tool params | Poor | Async RID + poll ≥60s; Workers request limits make polling awkward |
| InterProScan 5 REST | email required | Poor for sync path | Job submit/poll/result — same async constraints as BLAST |

### Verification notes (InterPro)

- **Docs**: https://interpro-documentation.readthedocs.io/en/latest/api.html
- **Base**: `https://www.ebi.ac.uk/interpro/api/`
- **Auth**: none for public data
- **Endpoints used**:
  - `GET /protein/uniprot/{accession}`
  - `GET /entry/interpro/protein/uniprot/{accession}?page_size=100`
- **Missing accession**: HTTP **204** (mapped to NOT_FOUND; no fabricated body)
- **Rate limits**: no hard published quota; be polite, cache responses (24h TTL), avoid bulk scraping
- **ToS / automation**: API is the documented programmatic interface for the website; student classroom use with caching is appropriate

### Why not live BLAST in this first Phase 4 slice

NCBI BLAST requires asynchronous job submission and status polling no more often
than once per minute. That pattern does not fit a single Cloudflare Worker
request cleanly. BLAST remains stubbed with import scaffolding until a Worker-
friendly approach (or documented sync alternative) is verified.

## What landed

- Live adapter: `src/adapters/interpro/`
- Registry: InterPro `liveAdapter: true` + import fallback retained
- Service: `src/lib/services/interproService.ts` (uses `executeAdapterJob` / `executeImportJob`)
- API:
  - `GET/POST/PATCH /api/projects/:id/modules/interpro`
  - `POST /api/projects/:id/modules/interpro/import`
- UI: InterPro module replaces `UnavailableModule` for slug `interpro` only
- Migration: `drizzle/0004_phase4_interpro.sql`
- Tests: adapter, normalize, service, UniProt validation, registry updates
- Integrity: failures surface clear errors; import stores raw with `source: "import"`; never invents domains/GO terms

## Explicitly excluded

- Live BLAST / SPRITE / CLEAN / Dali / Foldseek / SwissDock
- Deployment (`wrangler deploy`) — build only until John says to deploy
- Active-site synthesis, ShannonBot, reports

## Local verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
