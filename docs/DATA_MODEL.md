# Data Model

## Project

A student's analysis project.

Fields:

- id
- name
- createdAt
- updatedAt
- studentId if required (nullable; Phase 1 has no auth)
- status (`active` | `archived` | `demo`)
- isDemo (required; when true the UI must show DEMO DATA)

## Structure

Represents the student's PDB input.

Fields:

- id
- projectId
- pdbId
- title
- organism
- chains
- sequence
- metadata
- source (`student_input` | `rcsb` | `demo` | `import`)
- retrievedAt (null until a verified external fetch exists)

## Module

Represents a curriculum module.

Fields:

- id
- number
- slug
- name
- description
- order
- implemented (Phase 1: true only for `pdb-setup`)

## ModuleRun

Represents one execution of a module.

Fields:

- id
- projectId
- moduleId
- status (`not_started`, `in_progress`, `complete`, `error`, `not_available_yet`)
- startedAt
- completedAt
- parameters
- error

## Result

Represents scientific output.

Fields:

- id
- moduleRunId
- type
- rawData
- normalizedData
- source
- provenance
- isDemo
- createdAt

## Evidence

Represents evidence relevant to an interpretation.

Fields:

- id
- projectId
- type
- description
- sourceResultId
- residues
- strength
- provenance
- isDemo

## Note

Student-written observation.

Fields:

- id
- projectId
- moduleId
- content
- createdAt
- updatedAt

## Hypothesis

Current hypothesis.

Fields:

- id
- projectId
- text
- createdAt
- updatedAt

## HypothesisVersion

Historical hypothesis.

Fields:

- id
- hypothesisId
- text
- reasonForChange
- createdAt

## AIConversation

ShannonBot conversation.

Fields:

- id
- projectId
- messages
- evidenceReferences
- createdAt

## Report

Generated report.

Fields:

- id
- projectId
- type
- fileReference
- createdAt