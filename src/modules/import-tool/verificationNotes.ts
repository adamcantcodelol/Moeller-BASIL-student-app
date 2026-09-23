import type { ImportFormat } from "@/types/importWorkflow";

export interface ImportModuleConfig {
  toolName: string;
  instructions: string;
  acceptedFormats: readonly ImportFormat[];
  verificationNote: string;
}

export const IMPORT_MODULE_CONFIG: Record<string, ImportModuleConfig> = {
  sprite: {
    toolName: "SPRITE",
    acceptedFormats: ["text", "tsv", "csv", "json"],
    instructions:
      "Run the BASIL-approved SPRITE workflow, then paste or upload the raw output. Do not paste fabricated hits.",
    verificationNote:
      "Verified: no free public SPRITE REST API suitable for Cloudflare Workers was found. Structured import is the legitimate Phase 4 path.",
  },
  blast: {
    toolName: "BLAST",
    acceptedFormats: ["text", "json", "xml", "tsv"],
    instructions:
      "Student path: (1) Open https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE=Proteins (2) Paste your project sequence or PDB-derived FASTA (3) Run blastp (4) Download/export the alignment (Text, JSON, XML, or TSV) (5) Paste or upload that raw export below. Do not paste fabricated hits. Optional: if you use NCBI's URL API yourself, wait ≥60s between RID polls and include tool+email parameters.",
    verificationNote:
      "Verified: NCBI BLAST is free, but the official URL API is asynchronous (submit + poll RID ≤1/min). That does not fit a single Cloudflare Worker request/time budget, so this classroom build uses a clear import workflow rather than scraping or ToS-violating automation.",
  },
  clean: {
    toolName: "CLEAN",
    acceptedFormats: ["text", "json", "tsv"],
    instructions:
      "Obtain CLEAN results through the BASIL-approved mechanism and import the raw export.",
    verificationNote:
      "Verified: no Worker-ready free CLEAN automation is claimed in this build. Import stores raw results with provenance only.",
  },
  dali: {
    toolName: "Dali",
    acceptedFormats: ["text", "tsv", "json"],
    instructions:
      "Run Dali on the public Dali server (or DaliLite locally), then import the raw output.",
    verificationNote:
      "Verified: public Dali is primarily a web-form service; no documented free REST submit/poll API suitable for Workers was adopted. Import is the legitimate path.",
  },
  swissdock: {
    toolName: "SwissDock",
    acceptedFormats: ["text", "json"],
    instructions:
      "Run docking on swissdock.ch (web or command-line), then import the raw session export. Keep docking distinct from experimental structures.",
    verificationNote:
      "Verified: SwissDock exposes a free multi-step HTTPS API, but jobs routinely exceed Worker time budgets. Phase 4 uses structured import; live submit/poll may land later.",
  },
};
