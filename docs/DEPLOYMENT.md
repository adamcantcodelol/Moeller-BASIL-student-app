# Deployment

## Goals

The application should:

- remain available long-term
- cost $0
- use GitHub for source control
- have a stable public URL
- preserve student project data appropriately

## Recommended Architecture

GitHub
  ↓
Cloudflare Workers (`@opennextjs/cloudflare`)
  ↓
D1 Database
  ↓
Optional R2 Storage (not used in Phase 1)

SSR Next.js deploys to Workers, not static-only Pages. Phase 9 will replace
the local placeholder D1 `database_id` with a real production database.

Scientific services are accessed through server-side adapters.

## Environment Variables

Production secrets must be stored in the deployment platform's secret
management system.

Never commit `.env` files containing secrets.

## Deployment Steps

1. Push repository to GitHub.
2. Connect repository to hosting.
3. Configure build command.
4. Configure output directory.
5. Configure environment variables.
6. Create production database.
7. Run migrations.
8. Deploy.
9. Test production.
10. Verify scientific adapters.
11. Verify report generation.

## Database

Use migrations.

Never manually change production schema without a migration.

## Monitoring

Monitor:

- deployment failures
- API failures
- database errors
- rate limits
- report generation failures

## Backups

Determine an appropriate backup/export strategy for student project data.

## Public Access

The public site should not expose:

- service credentials
- administrative endpoints
- internal logs
- private student information

## Demo Mode

The site should have a demonstration project so visitors can understand the
platform without running every scientific tool.

Demo results must be explicitly labeled.