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
      "Prefer the live Run SPRITE button (Worker proxies grafss.ukm.my). Use this import only if live SPRITE is unavailable. Paste or upload a legitimate GrAfSS SPRITE export — do not paste fabricated hits.",
    verificationNote:
      "Verified: GrAfSS SPRITE REST API at https://grafss.ukm.my/api/sprite (upload + session_data + results). Live path is Worker-proxied so students never leave moeller-basil.workers.dev. Import remains optional fallback.",
  },
  blast: {
    toolName: "BLAST",
    acceptedFormats: ["text", "json", "xml", "tsv"],
    instructions:
      "Prefer the live Run BLAST button (Worker proxies NCBI BLAST Common URL API). Use this import only if live NCBI is unavailable. Paste or upload a legitimate BLAST export — do not paste fabricated hits.",
    verificationNote:
      "Verified: NCBI BLAST Common URL API (CMD=Put/Get). Live path is Worker-proxied with tool+email params and ≥60s RID poll spacing so students never leave moeller-basil.workers.dev. Import remains optional fallback.",
  },
  clean: {
    toolName: "CLEAN",
    acceptedFormats: ["text", "json", "tsv"],
    instructions:
      "Live CLEAN is unavailable after probing clean.platform.ibiofoundry.illinois.edu (MMLi jobmgr/fastapi returned 404; self-signed TLS; UI uses hCaptcha). Import a legitimate CLEAN export. Do not invent EC numbers.",
    verificationNote:
      "Probed 2026-09-23: Illinois CLEAN SPA references jobmgr.mmli1.ncsa.illinois.edu and mmli.fastapi.mmli1.ncsa.illinois.edu, but those hosts returned 404 with self-signed certificates from this environment, and the web UI loads hCaptcha. Kept import-only honestly — no fabricated EC predictions.",
  },
  dali: {
    toolName: "Dali",
    acceptedFormats: ["text", "tsv", "json"],
    instructions:
      "Prefer the live Run Dali button (Worker posts PDB+chain to ekhidna2 dump.cgi). Use import only if live Dali is down.",
    verificationNote:
      "Verified: Dali PDB search via http://ekhidna2.biocenter.helsinki.fi/cgi-bin/sans/dump.cgi (method=search, cd1=pdb+chain) + poll barcosel/tmp job page. Live path Worker-proxied. Import optional fallback.",
  },
  swissdock: {
    toolName: "SwissDock",
    acceptedFormats: ["text", "json"],
    instructions:
      "Prefer the live Run SwissDock button (requires student SMILES + box). Use import only if :8443 is unreachable from the Worker.",
    verificationNote:
      "Verified: SwissDock CLI REST https://swissdock.ch:8443 (Vina: preplig SMILES → preptarget PDB → setparameters → startdock → checkstatus). Live path Worker-proxied; ligands/boxes never invented. Import optional fallback.",
  },
};
