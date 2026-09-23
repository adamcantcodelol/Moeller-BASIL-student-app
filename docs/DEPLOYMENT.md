# Deployment

## Goals

The application should:

- remain available long-term
- cost $0
- use GitHub for source control
- have a stable public URL students can open on school computers (no install)
- preserve student project data appropriately

## Recommended Architecture

GitHub
  ↓
Cloudflare Workers (`@opennextjs/cloudflare`)
  ↓
D1 Database
  ↓
Optional R2 Storage (not required for Phase 2)

SSR Next.js deploys to Workers, not static-only Pages.

Scientific services are accessed through server-side adapters. Mol* loads in
the browser from jsDelivr + RCSB file CDN (school network must allow those
hosts).

## Deploy blockers (as of Phase 2 work)

1. **`wrangler.jsonc` still uses placeholder D1 `database_id`**
   `00000000-0000-4000-8000-000000000001` — production needs a real D1 UUID.
2. **Cloudflare account auth** — `wrangler whoami` must succeed (John must
   run `npx wrangler login` or provide an API token).
3. **Node.js ≥ 22** is required by current Wrangler / toolchain.
4. **OpenNext production build** (`npx opennextjs-cloudflare build`) must be
   run before `wrangler deploy`.
5. **School network allowlist** (runtime, not deploy):
   - `*.workers.dev` or custom domain for the app
   - `data.rcsb.org`, `files.rcsb.org`, `www.rcsb.org`
   - `cdn.jsdelivr.net` (Mol* assets)

No paid Cloudflare plan is required for Free-tier Workers + D1 Free.

## Exact deploy steps (John must authenticate)

Run from the repo root on a machine with Node 22+:

```bash
# 0) Toolchain
node -v   # >= 22
npm install

# 1) Authenticate Cloudflare (interactive browser or API token)
npx wrangler login
npx wrangler whoami

# 2) Create production D1 (once)
npx wrangler d1 create basil
# Copy the printed database_id into wrangler.jsonc → d1_databases[0].database_id
# Commit the updated wrangler.jsonc (database_id is not a secret).

# 3) Apply migrations to remote D1
npx wrangler d1 migrations apply basil --remote

# 4) Seed labeled DEMO DATA project (remote)
# Prefer a one-off remote seed once a seed script supports --remote,
# or insert via `wrangler d1 execute basil --remote --file=...`.
# Until then, use the in-app "Load demo" control after deploy if available.

# 5) Build OpenNext worker bundle
npx opennextjs-cloudflare build

# 6) Deploy
npx wrangler deploy

# 7) Smoke-test the public URL
# - open / 
# - create a project, save PDB 4HHB, Retrieve from RCSB, confirm Mol*
# - confirm DEMO DATA banner on demo project
```

Optional: add a GitHub Action that runs build + `wrangler deploy` using
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets so
pushes to `main` publish automatically. John must create those secrets.

## Environment Variables

Phase 2 needs **no paid API keys**. Production secrets (if any later) must
live in Cloudflare Workers secrets — never in the client bundle, never in
git.

Local-only files:

- `.dev.vars` (gitignored)
- `.env*` (gitignored)

## Database

Use migrations in `drizzle/`.

Never manually change production schema without a migration.

## Public Access

The public site should not expose:

- service credentials
- administrative endpoints
- internal logs
- private student information

## Demo Mode

The site should have a demonstration project so visitors can understand the
platform without running every scientific tool.

Demo results must be explicitly labeled **DEMO DATA**.
