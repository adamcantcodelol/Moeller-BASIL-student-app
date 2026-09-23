# Deploy ready — Moeller BASIL student app

The app is feature-complete for classroom use. **Do not deploy until John says so.**
This file lists the only remaining human steps.

## What John must do

1. **Cloudflare login**
   ```bash
   npm install
   npx wrangler login
   npx wrangler whoami
   ```

2. **Create real D1 and wire `wrangler.jsonc`**
   ```bash
   npx wrangler d1 create basil
   ```
   Replace placeholder `database_id` (`00000000-0000-4000-8000-000000000001`)
   in `wrangler.jsonc` with the printed UUID. Commit that change (not a secret).

3. **Apply migrations (remote)**
   ```bash
   npx wrangler d1 migrations apply basil --remote
   ```

4. **Optional ShannonBot LLM secrets** (local Socratic works without these)
   ```bash
   npx wrangler secret put GROQ_API_KEY
   # or: npx wrangler secret put OPENROUTER_API_KEY
   ```

5. **Deploy**
   ```bash
   npm run deploy
   ```

6. **Smoke-test** the printed `*.workers.dev` URL (or custom domain):
   - Home + create project
   - PDB setup + RCSB + Mol*
   - InterPro / Foldseek / SPRITE live paths
   - Import path for BLAST / CLEAN / Dali / SwissDock (SPRITE import optional fallback)
   - Evidence, hypothesis, ShannonBot, reports
   - Load demo → **DEMO DATA** banner

## What the public student URL unlocks

- Full BASIL curriculum modules 00–11 in one guided workflow
- Live: RCSB/Mol*, InterPro, Foldseek, SPRITE (Worker → grafss.ukm.my)
- Import: BLAST, CLEAN, Dali, SwissDock (SPRITE import optional fallback)
- Evidence synthesis, ChimeraX helpers, hypothesis builder
- ShannonBot (local always; optional Groq/OpenRouter if secrets set)
- Student + teacher reports
- Persistent projects on Cloudflare D1

## Still optional / not blockers

- Custom domain + school DNS
- GitHub Action auto-deploy secrets
- Cloud LLM keys (local ShannonBot is enough for class)
- R2 object storage
- Live NCBI BLAST inside Workers (kept as import for ToS/time-budget reasons)

## Quality gates (must be green before John deploys)

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
