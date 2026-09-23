# Scientific Modules

## Live

- RCSB, InterPro, Foldseek, SPRITE (Worker proxy of grafss.ukm.my)

## Import

- BLAST, CLEAN, Dali, SwissDock
- SPRITE import remains optional fallback when live API is down

## Synthesis / mentoring / reports

- Active-Site Evidence Synthesis (student residues only)
- Hypothesis Builder (student-authored)
- ShannonBot (local Socratic; optional LLM key blocker documented)
- Reports (markdown from stored data)

All modules refuse to invent scientific results.

## School network note

Students only need `*.workers.dev` (plus existing RCSB/Mol* hosts). They do **not** need `grafss.ukm.my` when SPRITE is fully Worker-proxied. Cloudflare Worker egress to `grafss.ukm.my` must work.
