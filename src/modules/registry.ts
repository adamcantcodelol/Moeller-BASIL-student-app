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
      "This module is registered but not implemented. The platform will not invent SPRITE results.",
    order: 1,
    implemented: false,
  },
  {
    id: "blast",
    number: "02",
    slug: "blast",
    name: "BLAST",
    description: "Compare protein sequences using BLAST.",
    purpose: "Collect sequence homology evidence.",
    instructions:
      "This module is registered but not implemented. The platform will not invent BLAST results.",
    order: 2,
    implemented: false,
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
      "This module is registered but not implemented. The platform will not invent CLEAN results.",
    order: 4,
    implemented: false,
  },
  {
    id: "dali",
    number: "05",
    slug: "dali",
    name: "Dali",
    description: "Compare protein structures using Dali.",
    purpose: "Collect structural similarity evidence.",
    instructions:
      "This module is registered but not implemented. The platform will not invent Dali matches.",
    order: 5,
    implemented: false,
  },
  {
    id: "foldseek",
    number: "06",
    slug: "foldseek",
    name: "Foldseek",
    description: "Search for structural homologs using Foldseek.",
    purpose: "Collect rapid structural similarity evidence.",
    instructions:
      "This module is registered but not implemented. The platform will not invent Foldseek hits.",
    order: 6,
    implemented: false,
  },
  {
    id: "active-site-evidence",
    number: "07",
    slug: "active-site-evidence",
    name: "Active-Site Evidence Synthesis",
    description: "Combine evidence from earlier modules for candidate residues.",
    purpose: "Identify residues supported by documented computational evidence.",
    instructions:
      "This module is registered but not implemented. Active-site residues will never be invented by an LLM.",
    order: 7,
    implemented: false,
  },
  {
    id: "swissdock",
    number: "08",
    slug: "swissdock",
    name: "SwissDock",
    description: "Investigate ligand docking.",
    purpose: "Collect docking observations distinct from experimental structures.",
    instructions:
      "This module is registered but not implemented. The platform will not invent docking poses.",
    order: 8,
    implemented: false,
  },
  {
    id: "hypothesis-builder",
    number: "09",
    slug: "hypothesis-builder",
    name: "Hypothesis Builder",
    description: "Write a student-authored, evidence-linked hypothesis.",
    purpose: "The student writes the hypothesis; the app does not write it for them.",
    instructions: "This module is registered but not implemented.",
    order: 9,
    implemented: false,
  },
  {
    id: "shannonbot-review",
    number: "10",
    slug: "shannonbot-review",
    name: "ShannonBot Review",
    description: "Discuss reasoning with the Socratic AI mentor.",
    purpose: "Guide students back to actual evidence.",
    instructions:
      "ShannonBot is not implemented in Phase 1 and will not fabricate results.",
    order: 10,
    implemented: false,
  },
  {
    id: "reports",
    number: "11",
    slug: "reports",
    name: "Reports",
    description: "Generate reproducible student and teacher reports.",
    purpose: "Document what was done and what evidence was obtained.",
    instructions: "Report generation is not implemented in Phase 1.",
    order: 11,
    implemented: false,
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
