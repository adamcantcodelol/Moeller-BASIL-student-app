# Development Guide

## Initial Setup

```bash
npm install
npm run db:migrate:local
npm run db:seed-demo
npm run dev
```

Then verify:

- development server (`npm run dev`)
- type checking (`npm run typecheck`)
- tests (`npm test`)
- production build (`npm run build`)

See `docs/PHASE1.md` for the current foundation.

## Development Order

Do not build the entire application at once.

### Phase 1

Foundation:

- project structure
- routing
- database
- types
- curriculum registry
- module interfaces
- demo data
- basic dashboard

### Phase 2

PDB Setup:

- PDB validation
- structure metadata
- Mol*

### Phase 3

Scientific infrastructure:

- adapter system
- job system
- caching
- provenance
- error handling

### Phase 4

Scientific modules:

- SPRITE
- BLAST
- InterPro
- CLEAN
- Dali
- Foldseek
- SwissDock

Build and verify each adapter independently.

### Phase 5

Evidence:

- evidence model
- active-site synthesis
- residue selection
- ChimeraX commands
- Mol* visualization modes

### Phase 6

Hypothesis Builder.

### Phase 7

ShannonBot.

### Phase 8

Reports.

### Phase 9

Deployment.

## Testing

After every meaningful feature:

1. typecheck
2. lint
3. unit tests
4. production build

## Git

Commit completed phases.

Example:

feat: add PDB project foundation

feat: add Molstar structure viewer

feat: add BLAST adapter

fix: handle failed scientific job

docs: document adapter architecture

## Cursor Workflow

When using Cursor:

1. Ask Cursor to read the relevant specification.
2. Ask it to inspect the repository.
3. Ask for a plan.
4. Review the plan.
5. Tell it to implement one phase.
6. Run tests.
7. Review changes.
8. Commit.
9. Continue.

Do not tell Cursor to "build everything" in one request.

## Scientific Verification

Before implementing an external service, verify:

- current API
- endpoint
- authentication
- request format
- response format
- rate limits
- terms of use
- whether automation is allowed

If verification fails, stop and design an import workflow.