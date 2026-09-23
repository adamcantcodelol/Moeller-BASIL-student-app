# Moeller BASIL Protein Platform

A free educational bioinformatics platform for the Moeller High School
Molecular Biology Research Course.

## Current status

Classroom build is deployed on Cloudflare Workers. Live scientific paths:
RCSB/Mol*, InterPro, Foldseek, SPRITE, BLAST, Dali, and SwissDock (Worker
proxied so students never leave this site). CLEAN remains import-only after
honest API probing. Import fallbacks remain when live upstream is down.
Results are never invented.

## What It Does

The platform organizes BASIL-style computational biology labs into one guided
workflow.

Students enter a PDB identifier and work through:

00. Protein / PDB Setup
01. SPRITE
02. BLAST
03. InterPro
04. CLEAN
05. Dali
06. Foldseek
07. Active-Site Evidence Synthesis
08. SwissDock
09. Hypothesis Builder
10. ShannonBot Review
11. Reports

## Educational Goal

The platform is designed to teach students how computational evidence can be
combined to investigate protein structure and function.

It should not hide the scientific reasoning.

## Core Features

- PDB structure input
- Mol* visualization (Phase 2 — basic viewer)
- BASIL curriculum workflow
- scientific-service adapters (later phases)
- result provenance
- active-site evidence synthesis
- structural overlays
- ChimeraX command generation
- hypothesis builder
- ShannonBot AI mentor
- student notes
- persistent projects
- student reports
- teacher reports
- demo mode

## Scientific Integrity

The platform never fabricates scientific results.

If an external service cannot be legitimately automated, the application should
provide a structured import workflow.

AI-generated explanations are not scientific evidence.

## Cost

The project is designed to operate using free infrastructure and legitimate
free tiers.

It must not bypass quotas or service restrictions.

## Local development

```bash
npm install
npm run db:migrate:local
npm run db:seed-demo
npm run dev
```

Then open http://localhost:3000

Quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Development

Read:

- AGENTS.md
- MASTER_BUILD_SPEC.md
- docs/PHASE1.md
- docs/ARCHITECTURE.md
- docs/SCIENTIFIC_MODULES.md
- docs/FREE_TIER.md
- docs/AI_SHANNONBOT.md
- docs/DATA_MODEL.md
- docs/CURRICULUM.md
- docs/SECURITY.md
- docs/DEVELOPMENT.md
- docs/DEPLOYMENT.md

## Project Philosophy

Build the platform as if it will be used by future students who have never
seen the underlying BASIL websites.

The application should make the workflow easier to access while preserving
the actual scientific reasoning behind every result.
