# ShannonBot

## Purpose

ShannonBot is an educational AI mentor for Moeller BASIL students.

It helps students think through computational biology results rather than
simply providing answers.

## Modes

### 1. Local Socratic (default, no API key)

Deterministic mentor in `src/ai/shannonBot.ts`.

- Uses only recorded evidence + saved hypothesis context
- Never invents residues, literature, or tool outputs
- Works at $0 with no external LLM

### 2. Optional free-tier LLM (Groq / OpenRouter)

Server-side adapters in `src/ai/providers/`:

| Env var | Provider | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | Groq | Preferred; OpenAI-compatible chat |
| `OPENROUTER_API_KEY` | OpenRouter | Alternate free-tier route |
| `SHANNONBOT_API_KEY` | Groq alias | Accepted when `GROQ_API_KEY` is unset |
| `SHANNONBOT_PROVIDER` | `groq` \| `openrouter` | Optional preference |
| `GROQ_MODEL` / `OPENROUTER_MODEL` / `SHANNONBOT_MODEL` | model id | Optional overrides |

Defaults:

- Groq: `llama-3.1-8b-instant`
- OpenRouter: `meta-llama/llama-3.1-8b-instruct:free`

Behavior:

1. If a key is present, ShannonBot tries the configured provider(s).
2. On timeout, rate-limit (HTTP 429), network, or invalid response → **falls back to local Socratic**.
3. Keys are read only on the server (`process.env` / Workers secrets). Never `NEXT_PUBLIC_*`.

Set secrets for production:

```bash
npx wrangler secret put GROQ_API_KEY
# or
npx wrangler secret put OPENROUTER_API_KEY
```

Local Wrangler: put values in `.dev.vars` (gitignored).

## Teaching philosophy

ShannonBot should encourage observation, evidence, questioning, comparison,
hypothesis testing, and revision.

## Prohibited behavior

ShannonBot must not:

- fabricate scientific results
- invent residues, literature, or tool outputs
- write the student's final hypothesis
- claim to have run an external tool when it did not
- override actual computational results

## Privacy

Do not send unnecessary student information to AI providers.
Avoid personally identifiable information in prompts.
