import type { BasilModuleDefinition } from "@/types/module";

export const PDB_SETUP_MODULE_ID = "pdb-setup";

export const CURRICULUM_MODULES: readonly BasilModuleDefinition[] = [
  {
    id: PDB_SETUP_MODULE_ID,
    number: "00",
    slug: "pdb-setup",
    name: "Protein / PDB Setup",
    description:
      "Select and record a PDB identifier as the project's input structure.",
    purpose:
      "Establish a verified protein structure identifier that later modules will analyze.",
    instructions:
      "Enter a four-character PDB ID, then retrieve metadata from the RCSB PDB Data API. Review the Mol* view of the real RCSB coordinates. Do not invent title, organism, sequence, or active-site information.",
    order: 0,
    implemented: true,
  },
  {
    id: "sprite",
    number: "01",
    slug: "sprite",
    name: "SPRITE",
    description: "Investigate structural and sequence relationships using SPRITE.",
    purpose: "Collect SPRITE evidence defined by the BASIL curriculum.",
    instructions:
      "SPRITE has no verified free public API suitable for Cloudflare Workers. Run the BASIL-approved SPRITE workflow externally, then import the raw export. Results are never invented.",
    order: 1,
    implemented: true,
  },
  {
    id: "blast",
    number: "02",
    slug: "blast",
    name: "BLAST",
    description: "Compare protein sequences using BLAST.",
    purpose: "Collect sequence homology evidence.",
    instructions:
      "NCBI BLAST is asynchronous (poll RID ≥60s) and does not fit a single Worker request. Run BLAST on NCBI (or equivalent), then import the raw export. Results are never invented.",
    order: 2,
    implemented: true,
  },
  {
    id: "interpro",
    number: "03",
    slug: "interpro",
    name: "InterPro",
    description: "Identify domains, families, and signatures.",
    purpose: "Collect functional annotation evidence.",
    instructions:
      "Enter a UniProt accession and retrieve domain/family annotations from the free InterPro REST API. On failure, import a legitimate InterPro / InterProScan export. The platform will not invent annotations.",
    order: 3,
    implemented: true,
  },
  {
    id: "clean",
    number: "04",
    slug: "clean",
    name: "CLEAN",
    description: "Perform the CLEAN analysis defined by BASIL.",
    purpose: "Collect CLEAN results with provenance.",
    instructions:
      "No verified free Worker-friendly CLEAN automation is claimed yet. Import legitimate CLEAN output. Results are never invented.",
    order: 4,
    implemented: true,
  },
  {
    id: "dali",
    number: "05",
    slug: "dali",
    name: "Dali",
    description: "Compare protein structures using Dali.",
    purpose: "Collect structural similarity evidence.",
    instructions:
      "The public Dali server is web-form oriented without a documented free REST submit API suitable for Workers. Run Dali externally and import the raw export. Results are never invented.",
    order: 5,
    implemented: true,
  },
  {
    id: "foldseek",
    number: "06",
    slug: "foldseek",
    name: "Foldseek",
    description: "Search for structural homologs using Foldseek.",
    purpose: "Collect rapid structural similarity evidence.",
    instructions:
      "Run a live Foldseek search against pdb100 using the project PDB (RCSB file download + search.foldseek.com API), or import a legitimate export if the API is unavailable. Hits are never invented.",
    order: 6,
    implemented: true,
  },
  {
    id: "active-site-evidence",
    number: "07",
    slug: "active-site-evidence",
    name: "Active-Site Evidence Synthesis",
    description: "Combine evidence from earlier modules for candidate residues.",
    purpose: "Identify residues supported by documented computational evidence.",
    instructions:
      "Record candidate residues only when supported by earlier module observations. The platform never invents active-site residues. Use ChimeraX commands and Mol* modes to inspect evidence-backed positions.",
    order: 7,
    implemented: true,
  },
  {
    id: "swissdock",
    number: "08",
    slug: "swissdock",
    name: "SwissDock",
    description: "Investigate ligand docking.",
    purpose: "Collect docking observations distinct from experimental structures.",
    instructions:
      "SwissDock command-line API is multi-step and long-running (often minutes). Use swissdock.ch externally, then import raw output. Docking poses are never invented and remain distinct from experimental structures.",
    order: 8,
    implemented: true,
  },
  {
    id: "hypothesis-builder",
    number: "09",
    slug: "hypothesis-builder",
    name: "Hypothesis Builder",
    description: "Write a student-authored, evidence-linked hypothesis.",
    purpose: "The student writes the hypothesis; the app does not write it for them.",
    instructions:
      "Draft and revise your own hypothesis using recorded evidence. The platform reviews structure but never authors the claim.",
    order: 9,
    implemented: true,
  },
  {
    id: "shannonbot-review",
    number: "10",
    slug: "shannonbot-review",
    name: "ShannonBot Review",
    description: "Discuss reasoning with the Socratic AI mentor.",
    purpose: "Guide students back to actual evidence.",
    instructions:
      "Chat with ShannonBot about your recorded evidence and hypothesis. Local Socratic mode works without an API key; optional free-tier LLM keys can be added later. Results are never fabricated.",
    order: 10,
    implemented: true,
  },
  {
    id: "reports",
    number: "11",
    slug: "reports",
    name: "Reports",
    description: "Generate reproducible student and teacher reports.",
    purpose: "Document what was done and what evidence was obtained.",
    instructions:
      "Generate markdown reports from stored project data only. Reports never invent scientific results.",
    order: 11,
    implemented: true,
  },
];

export function getModuleBySlug(
  slug: string,
): BasilModuleDefinition | undefined {
  return CURRICULUM_MODULES.find((module) => module.slug === slug);
}

export function getImplementedModuleIds(): string[] {
  return CURRICULUM_MODULES.filter((module) => module.implemented).map(
    (module) => module.id,
  );
}
