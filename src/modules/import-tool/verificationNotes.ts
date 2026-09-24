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
    acceptedFormats: ["csv", "text", "json", "tsv"],
    instructions:
      "Prefer the live Run CLEAN button (Worker proxies the UIUC MoleculeMaker CLEAN API). Use this import only if live CLEAN is unavailable: paste a legitimate CLEAN maxsep CSV. Do not invent EC numbers.",
    verificationNote:
      "Verified 2026-09-24: the CLEAN SPA loads its backend from /assets/config/envvars.json → https://mmli.fastapi.mmli2.ncsa.illinois.edu (valid TLS, enableHCAPTCHA=false, no auth). POST /clean/jobs → GET /clean/jobs/{id} (phase) → GET /clean/results/{id}. A real P00918 job completed in ~77s, but /clean/results returned HTTP 500 (MMLI MinIO store down). The app health-checks results first and marks CLEAN unavailable instead of inventing EC numbers. Import remains the fallback.",
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
