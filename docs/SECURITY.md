# Security

## Secrets

Never commit:

- API keys
- access tokens
- passwords
- private keys

Use server-side environment variables.

## Client Security

The browser should never receive provider secrets.

All external authenticated requests should pass through the backend.

## Input Validation

Validate:

- PDB IDs
- sequences
- filenames
- uploaded data
- API parameters
- student-entered text

## File Uploads

Validate:

- file type
- size
- extension
- content

Do not execute uploaded files.

## AI Security

Do not send unnecessary private information to AI providers.

Treat AI output as untrusted text.

Do not allow AI-generated content to execute code or database queries.

## Scientific Integrity

Never allow AI output to overwrite scientific raw results.

Raw external results are immutable records.

## Rate Limiting

Rate-limit:

- expensive scientific requests
- AI requests
- report generation
- uploads

## Logging

Log enough information to debug failures without logging secrets or
unnecessary student information.

## Error Messages

Do not expose:

- API keys
- stack traces in production
- internal credentials
- database connection information

Give students useful but safe error messages.