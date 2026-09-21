# Free-Tier Architecture

## Requirement

The application must be deployable and usable at $0.

## Principles

Do not require:

- paid hosting
- paid databases
- paid AI
- paid scientific APIs

## Preferred Services

GitHub:
repository and source control.

Cloudflare:
hosting, serverless functions, database, and optional object storage.

Free AI services:
only use providers whose free usage is currently legitimate and sufficient.

The exact provider should be verified before deployment.

## API Keys

All keys are server-side.

Never place secrets in:

- React components
- browser JavaScript
- GitHub repository
- client environment variables

## Rate Limits

Use:

- caching
- deduplication
- throttling
- retries with exponential backoff
- request queues
- result reuse

Never bypass provider quotas.

Never rotate keys/accounts to evade limits.

## Scientific Services

If a service provides no usable API:

Use:

1. export/download
2. upload/import
3. validation
4. normalization
5. provenance

rather than inventing an integration.

## Cost Monitoring

The application should clearly identify external services that may have
limits.

Do not accidentally create paid usage.

## Failure Behavior

A failed free-tier request should never produce fake scientific data.

Display:

- service unavailable
- retry
- manual import if supported