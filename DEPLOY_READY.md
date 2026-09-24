# Deploy ready — Moeller BASIL student app

Classroom build targets Cloudflare Workers + D1. Deploy when John says so.

## Deploy

```bash
npm install
npx wrangler whoami
npx wrangler d1 migrations apply basil --remote
npm run deploy
```

D1 id is already in `wrangler.jsonc` (`51dc8a93-7078-4d0a-855a-66d076c3034f`).

## Smoke-test (printed `*.workers.dev` URL)

1. Home + create project
2. PDB Setup → retrieve **4HHB** (needs sequence + chains)
3. Live: InterPro / Foldseek / SPRITE / **BLAST** (Run BLAST → real RID + hits + provenance `https://blast.ncbi.nlm.nih.gov`)
4. Live Dali / SwissDock when enabled (SwissDock needs student SMILES + box)
5. CLEAN: live via UIUC MoleculeMaker (health-checked); "unavailable" + Retry and CSV import fallback when its result storage is down
6. Evidence, hypothesis, ShannonBot, reports
7. Load demo → **DEMO DATA** banner

## Live vs import

- Live: RCSB/Mol*, InterPro, Foldseek, SPRITE, BLAST (+ Dali/SwissDock when adapters are live)
- Import remains optional fallback when upstream is down
- Students should not need to open NCBI / GrAfSS / Dali / SwissDock in the browser for live paths

## Quality gates

```bash
npm run typecheck && npm run lint && npm test
```
