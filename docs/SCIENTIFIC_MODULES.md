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

- **CLEAN** — Live via the public UIUC MoleculeMaker API (`https://mmli.fastapi.mmli2.ncsa.illinois.edu`, found in the SPA's runtime `/assets/config/envvars.json`; the 2026-09-23 probe hit stale fallback hosts). No auth/captcha (`enableHCAPTCHA=false`). Flow: `POST /clean/jobs` `{email:"", job_info: JSON.stringify({input_fasta:[{header, sequence}]})}` → poll `GET /clean/jobs/{id}` (`queued|processing|completed|error|canceled`) → `GET /clean/results/{id}` → `[{sequence, result:[{ecNumber:"EC:x.x.x.x", score}]}]`. Score is CLEAN confidence (High ≥0.8, Medium 0.2–0.8, Low <0.2). Limits: ≤1022 aa, ≤20 sequences. 2026-09-24: a real P00918 job completed in ~77 s but `/clean/results` returned HTTP 500 (MMLI MinIO down: `minioapi.mmli.fastapi.mmli2…` → 503 "no available server"). The pipeline health-checks results first and marks CLEAN "unavailable" (Retry + CSV import) instead of inventing EC numbers.

## Import remains optional fallback

For every live tool above when upstream is down.

## Synthesis / mentoring / reports

- Active-Site Evidence Synthesis, Hypothesis Builder, ShannonBot, Reports

All modules refuse to invent scientific results.
