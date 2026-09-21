# Phase 1 — Foundation

Phase 1 establishes the educational platform shell. It does **not** run
scientific tools.

## Technical verification (2026-09-18)

Verified against current public documentation:

- **Next.js on Cloudflare is supported and free** on the Workers Free plan
  (100,000 Worker requests/day; static assets unlimited). D1 Free includes
  5 million rows read/day, 100,000 rows written/day, and 5 GB storage.
- **Current Cloudflare recommendation for new Next.js apps is vinext**
  (beta, Vite reimplementation of the Next.js API). That is not a Next.js
  replacement requirement, and it is still beta.
- **This repository uses stock Next.js App Router plus
  `@opennextjs/cloudflare`.** OpenNext remains officially documented, supports
  App Router and Route Handlers, and can access D1 via
  `getCloudflareContext()`. Target runtime is **Cloudflare Workers**, not the
  deprecated `@cloudflare/next-on-pages` adapter.
- **Drizzle ORM supports Cloudflare D1** (`drizzle-orm/d1`). Local unit tests
  use the same SQLite schema through `@libsql/client` (async, like D1).
- **R2 incremental cache and Cloudflare Images are not enabled.** They are
  optional and not required for Phase 1.

No paid service is required.

## Included

- Next.js App Router + TypeScript
- D1 schema and Wrangler migrations
- curriculum registry 00–11
- project / PDB structure / notes / module-run services
- PDB Setup module (identifier validation and persistence only)
- placeholder pages for modules 01–11
- labeled DEMO DATA project
- scientific adapter TypeScript contract (not implemented)

## Explicitly excluded

- Mol*
- RCSB or any PDB file/metadata download
- SPRITE, BLAST, InterPro, CLEAN, Dali, Foldseek, SwissDock
- ShannonBot
- reports
- invented scientific results or APIs

## Local commands

```bash
npm install
npm run db:migrate:local
npm run db:seed-demo
npm run dev
```

Then open http://localhost:3000
