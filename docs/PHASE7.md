# Phase 7 — ShannonBot

## Mode shipped

**Local Socratic mentor** (free, no API key): replies from recorded evidence + hypothesis context only.

## Optional LLM blocker

To enable a free-tier cloud LLM later, set one server-side secret (never `NEXT_PUBLIC_`):

- `GROQ_API_KEY`, or
- `OPENROUTER_API_KEY`, or
- `SHANNONBOT_API_KEY`

Until John provides a key, ShannonBot stays in local mode and surfaces this blocker in the UI.
It still will not invent scientific results.
