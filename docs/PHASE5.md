# Phase 5 — Evidence, active-site synthesis, Mol* modes

## Included

- Evidence model with `source_module_id` + residue list
- Student-authored evidence API (`/api/projects/:id/evidence`)
- Active-Site Evidence Synthesis module (no LLM residue invention)
- ChimeraX command generator from recorded residues only
- Mol* mode selector: protein / overlay / active-site / active-site-overlay
- Overlay modes require a comparison PDB (not invented)

## Integrity

- Residues must be entered by the student from prior module observations
- Empty residue lists are rejected
- ChimeraX scripts comment clearly when no evidence exists
- Demo data remains labeled via `project.isDemo`

## Gates

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Not in this phase

- Hypothesis Builder (Phase 6)
- ShannonBot (Phase 7)
- Reports (Phase 8)
- Deploy
