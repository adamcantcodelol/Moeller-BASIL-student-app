# AGENTS.md

## Project

This repository contains the Moeller BASIL Protein Platform, a free educational
bioinformatics platform for the Molecular Biology Research Course at Moeller
High School.

The application organizes the BASIL computational biology curriculum into one
guided workflow.

## Core Principle

This is a scientific education platform.

Never fabricate scientific results.

Never claim an external service exists if it has not been verified.

Never silently substitute simulated data for real experimental/computational
results.

If a tool cannot be automated legitimately, provide an explicit import/manual
workflow.

## Development Rules

Before implementing a feature:

1. Read MASTER_BUILD_SPEC.md.
2. Read the relevant documentation in docs/.
3. Inspect the existing implementation.
4. Determine whether the required external service/API actually exists.
5. Design the smallest maintainable implementation.
6. Preserve scientific provenance.

## Architecture Rules

Use an adapter architecture for scientific services.

Every external scientific service should have:

- a typed adapter interface
- a real implementation where legally/technically possible
- validation
- timeout handling
- error handling
- provenance metadata
- an import/manual-result fallback where appropriate

Do not put scientific-service logic directly inside UI components.

## Scientific Integrity

Every result must distinguish:

- student input
- raw external result
- normalized result
- derived interpretation
- AI-generated explanation

AI explanations must never be represented as experimental evidence.

Active-site residues must be supported by documented computational evidence.

## AI Rules

ShannonBot is a mentor, not an answer generator.

It should:

- ask questions
- identify evidence
- explain concepts
- point out contradictions
- guide students toward their own conclusions

It should not:

- write the student's hypothesis
- invent scientific evidence
- fabricate results
- pretend to have run a scientific tool
- make unsupported claims

## Free-Tier Requirement

The application must be designed to operate at $0 cost.

Do not design around paid APIs.

Do not bypass rate limits.

Do not rotate accounts or keys to evade quotas.

Use caching, batching, request throttling, legitimate free tiers, and manual
imports where necessary.

All API keys must remain server-side.

## UI

The application should feel like an educational research platform rather than
a generic AI website.

Use Moeller High School / Molecular Biology Research Course branding.

The interface should prioritize:

1. scientific results
2. evidence
3. visualization
4. student interpretation
5. reproducibility

## Code Quality

Prefer:

- TypeScript
- strongly typed interfaces
- modular components
- small functions
- clear naming
- validation
- error boundaries
- automated tests

Avoid:

- giant components
- hard-coded scientific results
- duplicated service logic
- hidden API calls
- magic numbers without explanation

## Git

Make focused commits.

Recommended commit style:

feat:
fix:
refactor:
docs:
test:
chore:

Never commit:

- API keys
- passwords
- secrets
- private credentials
- student personally identifiable information

## Before Declaring Work Complete

Run:

- typecheck
- tests
- lint
- production build

Fix errors rather than ignoring them.

Document incomplete integrations explicitly.