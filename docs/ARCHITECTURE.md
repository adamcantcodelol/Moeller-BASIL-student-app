# Architecture

## Runtime (Phase 1)

- Frontend and API: Next.js App Router (TypeScript)
- Deploy target: Cloudflare Workers via `@opennextjs/cloudflare`
- Database: Cloudflare D1 with Drizzle ORM
- Local tests: same SQLite schema through `@libsql/client`

Cloudflare currently recommends vinext for new Next.js apps. vinext is still
beta and reimplements Next.js on Vite. This project stays on stock Next.js plus
OpenNext until vinext is production-stable. Do not use the deprecated
`@cloudflare/next-on-pages` adapter.

R2 cache and Cloudflare Images are not enabled in Phase 1.

## Overview

The application should be divided into:

- frontend
- backend/API
- database
- scientific adapters
- AI layer
- reporting
- visualization

## Suggested Structure

src/
  app/
  components/
  modules/
  lib/
  adapters/
  db/
  ai/
  reports/
  visualization/
  types/

## Scientific Adapter Layer

The UI must never directly call external scientific services.

Instead:

UI
 ↓
Application Service
 ↓
Scientific Adapter
 ↓
External Service

This makes services replaceable.

## Result Pipeline

External result

→ raw result

→ validated result

→ normalized result

→ evidence

→ visualization

→ student interpretation

## Provenance

Every scientific result must contain provenance.

Example:

{
  "tool": "BLAST",
  "source": "NCBI",
  "retrievedAt": "...",
  "parameters": {},
  "rawResultId": "...",
  "version": "..."
}

## Database

Use relational tables for:

- users/students where appropriate
- projects
- structures
- modules
- module_runs
- results
- evidence
- notes
- hypotheses
- hypothesis_versions
- AI conversations
- reports

Keep raw scientific outputs separate from normalized data.

## Visualization

Mol* should be treated as a visualization layer.

Visualization selections should be generated from structured scientific
evidence.

Never let visualization code determine scientific truth.