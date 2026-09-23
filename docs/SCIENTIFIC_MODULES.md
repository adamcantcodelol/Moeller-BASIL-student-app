# Scientific Modules

## Live (Worker-proxied — students stay on `*.workers.dev`)

- RCSB / Mol*
- InterPro
- Foldseek
- SPRITE (`grafss.ukm.my`)
- **BLAST** (NCBI Common URL API; default `swissprot`; RID poll ≥60s)
- **Dali** (ekhidna2 `dump.cgi` PDB search + job page poll)
- **SwissDock** (`swissdock.ch:8443` Vina path; requires student SMILES + box)

## Import-only after probe

- **CLEAN** — Illinois SPA references MMLi jobmgr/fastapi, but those hosts returned 404 with self-signed TLS from our probe environment; UI uses hCaptcha. Kept import-only honestly.

## Import remains optional fallback

For every live tool above when upstream is down.

## Synthesis / mentoring / reports

- Active-Site Evidence Synthesis, Hypothesis Builder, ShannonBot, Reports

All modules refuse to invent scientific results.
