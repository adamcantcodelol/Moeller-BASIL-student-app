# Deployment

## Goals

- Remain available long-term at $0
- GitHub for source control
- Stable public URL students can open on school computers
- Preserve student project data appropriately

## Recommended architecture

GitHub → Cloudflare Workers (`@opennextjs/cloudflare`) → D1 → optional R2

SSR Next.js deploys to Workers (not static-only Pages).

Scientific services run through server-side adapters. Mol* loads in the browser
from jsDelivr + RCSB CDN (school network must allow those hosts).

## Deploy blockers (John must complete)

1. **Placeholder D1 `database_id` in `wrangler.jsonc`**
   Currently `00000000-0000-4000-8000-000000000001` — replace with a real D1 UUID.
2. **Cloudflare auth** — `npx wrangler login` (or API token) so `npx wrangler whoami` succeeds.
3. **Node.js ≥ 22**
4. **OpenNext build** before deploy: `npm run deploy:build`
5. **Optional LLM secrets** (only if using cloud ShannonBot):
   `npx wrangler secret put GROQ_API_KEY` and/or `OPENROUTER_API_KEY`
6. **School network allowlist** (runtime):
   - `*.workers.dev` or custom domain
   - `data.rcsb.org`, `files.rcsb.org`, `www.rcsb.org`
   - `cdn.jsdelivr.net` (Mol*)
   - Foldseek/InterPro hosts used by live adapters
   - Optional LLM: `api.groq.com` and/or `openrouter.ai`

No paid Cloudflare plan is required for Free Workers + D1 Free.

## Exact deploy steps (John authenticates)

```bash
# 0) Toolchain
node -v   # >= 22
npm install

# 1) Authenticate Cloudflare
npx wrangler login
npx wrangler whoami

# 2) Create production D1 (once)
npx wrangler d1 create basil
# Copy the printed database_id into wrangler.jsonc → d1_databases[0].database_id
# Commit the updated wrangler.jsonc (database_id is not a secret).

# 3) Apply migrations to remote D1
npx wrangler d1 migrations apply basil --remote

# 4) Seed labeled DEMO DATA project (remote)
# Prefer in-app "Load demo" after deploy, or:
# npx wrangler d1 execute basil --remote --file=...
# Local seed equivalent:
npm run db:seed-demo

# 5) Optional ShannonBot LLM secrets
npx wrangler secret put GROQ_API_KEY
# and/or:
# npx wrangler secret put OPENROUTER_API_KEY

# 6) Build OpenNext worker bundle
npm run deploy:build

# 7) Deploy
npm run deploy

# 8) Smoke-test the public URL
# - open /
# - create a project, save PDB 4HHB, Retrieve from RCSB, confirm Mol*
# - confirm DEMO DATA banner on demo project
# - ShannonBot local mode works without secrets
```

Optional: GitHub Action with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
repository secrets so pushes to `main` publish automatically. John must create those secrets.

## Environment variables

Core scientific modules need **no paid API keys**.

Optional ShannonBot (server-side only; never `NEXT_PUBLIC_`):

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `SHANNONBOT_API_KEY` (Groq alias)
- `SHANNONBOT_PROVIDER`, `GROQ_MODEL`, `OPENROUTER_MODEL`, `SHANNONBOT_MODEL`

Local-only files (gitignored): `.dev.vars`, `.env*`

See `.env.example` and `docs/AI_SHANNONBOT.md`.

## Database

Use migrations in `drizzle/`. Never change production schema without a migration.

## Public access

Do not expose service credentials, admin endpoints, internal logs, or private
student information.

## Demo mode

Demonstration projects must be labeled **DEMO DATA**. Never silently substitute
demo data for a failed real analysis.

## See also

- `DEPLOY_READY.md` — short checklist of what John must do and what students unlock
