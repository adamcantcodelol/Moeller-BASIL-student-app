# Moeller BASIL Protein Platform
## Master Build Specification

## 1. Purpose

Build a completely free educational web application that allows students in
Moeller High School's Molecular Biology Research Course to perform and organize
BASIL-style computational protein analysis from a single interface.

The student should be able to enter a PDB identifier and proceed through the
curriculum in order.

The application must make computational biology easier to learn without hiding
the scientific reasoning.

---

# 2. Core Workflow

The curriculum is:

00. Protein / PDB Setup
01. SPRITE
02. BLAST
03. InterPro
04. CLEAN
05. Dali
06. Foldseek
07. Active-Site Evidence Synthesis
08. SwissDock
09. Hypothesis Builder
10. ShannonBot Review
11. Reports

Students should be able to move through the modules sequentially while still
being able to revisit previous modules.

Each module should have:

- purpose
- instructions
- inputs
- execution state
- raw results
- normalized results
- interpretation
- evidence
- student observations
- completion status

---

# 3. PDB Input

The student begins with a PDB identifier.

The application should:

1. Validate the identifier.
2. Retrieve available structural information.
3. Display the protein in Mol*.
4. Show relevant metadata.
5. Save the structure to the project.
6. Create a reproducible record of the source.

The application must never silently replace the student's structure.

---

# 4. Mol* Visualization

Integrate Mol* for interactive protein visualization.

Required visualization modes:

### Mode A — Protein Overlay

Display:

- input protein
- structurally similar protein

Use distinguishable visual representations.

### Mode B — Input Active Site

Highlight:

- active-site residues
- remaining protein

### Mode C — Active-Site Overlay

Display:

- input protein active site
- comparison protein active site

The active site must come from computational/scientific evidence.

It must not be invented by an LLM.

---

# 5. ChimeraX

The application should be able to generate ChimeraX commands dynamically.

Protein numbering:

- input protein = #1
- comparison protein = #2

The system should generate selections based on actual evidence.

Do not hard-code residue numbers.

---

# 6. Scientific Modules

Each scientific module must use an adapter.

Example:

interface ScientificAdapter<Input, Output> {
  run(input: Input): Promise<Output>;
  normalize(output: Output): NormalizedResult;
  getProvenance(): Provenance;
}

Adapters must support:

- execution
- validation
- timeouts
- errors
- provenance
- caching
- import/manual fallback

---

# 7. SPRITE

SPRITE does not have to be assumed to have an API.

Before implementation, verify the current legitimate mechanism for obtaining
SPRITE results.

If direct automation is unavailable:

- provide a structured result-import workflow
- explain what the student should obtain
- validate imported data
- preserve the original file
- normalize the data

Never fabricate SPRITE output.

---

# 8. BLAST

Implement legitimate BLAST integration where technically and legally
appropriate.

Support:

- sequence input
- search execution
- result retrieval
- hit normalization
- identity
- similarity
- alignment information
- accession identifiers

Store raw and normalized results separately.

---

# 9. InterPro

Use legitimate InterPro resources where available.

Capture relevant:

- protein families
- domains
- conserved regions
- signatures
- functional annotations

Every annotation should retain its source.

---

# 10. CLEAN

Implement CLEAN using a verified legitimate interface.

Do not invent an API.

If the service cannot be automated reliably, provide an import workflow.

Results should be stored with provenance.

---

# 11. Dali

Provide structural similarity analysis using Dali or a verified legitimate
workflow.

Capture:

- structural matches
- similarity metrics
- aligned regions
- PDB identifiers
- relevant structural observations

---

# 12. Foldseek

Provide Foldseek structural similarity analysis.

Capture:

- target
- matched structures
- similarity metrics
- alignment information
- structural regions

---

# 13. Active-Site Evidence Synthesis

This is a major component of the application.

The application should combine evidence from multiple modules.

Possible evidence sources include:

- SPRITE
- structural alignment
- Foldseek
- Dali
- InterPro
- sequence conservation
- known annotations
- docking

The application should identify residues/sites supported by evidence.

For every proposed active-site residue, display:

- residue number
- amino acid
- evidence source
- supporting module
- comparison residue if applicable
- confidence/evidence strength
- explanation

Do not reduce scientific evidence to a mysterious AI score.

---

# 14. SwissDock

Provide a legitimate SwissDock workflow where possible.

The workflow should support:

- ligand input
- target structure
- docking submission
- result retrieval/import
- binding poses
- relevant interaction information

Docking results must remain distinguishable from experimentally validated
results.

---

# 15. Hypothesis Builder

The student should be encouraged to create their own hypothesis.

The application can display structured evidence such as:

- protein family
- similar proteins
- hydrolase classifications
- structural similarities
- active-site evidence
- docking evidence

The student writes the hypothesis.

The application checks whether the hypothesis is:

- testable
- consistent with evidence
- appropriately specific
- supported by cited observations

The AI should not simply write the hypothesis for the student.

---

# 16. ShannonBot

ShannonBot is the AI mentor.

Its teaching style is Socratic.

It should ask things such as:

"What do you notice about these two structures?"

"What evidence supports that conclusion?"

"Which residues appear conserved?"

"What would you expect if your hypothesis were correct?"

It should point students back to actual data.

It should identify contradictions.

It should explain scientific concepts when necessary.

It should not provide unsupported answers.

---

# 17. Reports

Generate a student analysis report.

Include:

- project metadata
- PDB structure
- module completion
- raw results
- normalized results
- evidence
- visualizations
- student observations
- hypothesis
- hypothesis revisions
- ShannonBot feedback
- provenance

Generate a teacher report containing additional useful information such as:

- completion history
- module execution history
- imported files
- errors
- evidence sources
- student notes
- hypothesis history

Reports should be reproducible.

---

# 18. Persistence

Student progress must persist.

Persist:

- project
- PDB entry
- module states
- results
- notes
- observations
- evidence
- hypothesis
- hypothesis history
- AI review history
- report metadata

Use stable IDs.

---

# 19. Free Architecture

Preferred architecture:

Frontend:
- React / Next.js or equivalent
- TypeScript

Hosting:
- GitHub
- Cloudflare Pages or equivalent free hosting

Backend:
- Cloudflare Workers or equivalent

Database:
- Cloudflare D1 or equivalent free database

Optional storage:
- Cloudflare R2 or equivalent

AI:
- legitimate free-tier provider(s)

No paid service should be required for normal operation.

---

# 20. Security

Never expose API keys in frontend code.

Never commit secrets.

Use:

- server-side environment variables
- request validation
- rate limiting
- input sanitization
- output validation
- safe error messages

Students should not be able to access service credentials.

---

# 21. Scientific Data Architecture

Each result should retain:

- source
- timestamp
- tool
- tool version if available
- request parameters
- raw output
- normalized output
- interpretation
- provenance

This allows the student and teacher to distinguish actual data from
interpretation.

---

# 22. Demonstration Mode

The application should include clearly labeled demonstration data.

Demo data must never be confused with real analysis.

Use explicit labels such as:

DEMO DATA

Never silently substitute demo data for a failed real analysis.

---

# 23. Error Handling

If an external service fails:

- explain what failed
- preserve the student's work
- provide retry
- provide import/manual workflow if available
- never generate fake results

---

# 24. Testing

Tests should cover:

- PDB validation
- project creation
- module state
- adapter interfaces
- result normalization
- provenance
- active-site evidence
- hypothesis validation
- report generation
- API failure handling

---

# 25. Development Strategy

Build in phases.

Phase 1:
Foundation and data model.

Phase 2:
PDB Setup + Mol*.

Phase 3:
Scientific adapter infrastructure.

Phase 4:
BASIL computational modules.

Phase 5:
Evidence synthesis + visualization.

Phase 6:
Hypothesis Builder.

Phase 7:
ShannonBot.

Phase 8:
Reports.

Phase 9:
Deployment and testing.

Do not attempt to build every integration in one pass.