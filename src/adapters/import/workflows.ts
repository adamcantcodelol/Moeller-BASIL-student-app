import type {
  ImportFormat,
  ImportPayload,
  ImportValidationResult,
  ImportWorkflowDefinition,
} from "@/types/importWorkflow";
import { IMPORT_FORMATS } from "@/types/importWorkflow";
import type { ScientificToolId } from "@/adapters/registry";

function formatCheck(
  payload: ImportPayload,
  accepted: readonly ImportFormat[],
): ImportValidationResult {
  const errors: string[] = [];

  if (!payload.content || !payload.content.trim()) {
    errors.push("Imported content is empty. Paste or upload the real tool output.");
  }

  if (!IMPORT_FORMATS.includes(payload.format)) {
    errors.push(`Unsupported format "${payload.format}".`);
  } else if (!accepted.includes(payload.format)) {
    errors.push(
      `Format "${payload.format}" is not accepted for ${payload.tool}. Accepted: ${accepted.join(", ")}.`,
    );
  }

  if (payload.tool.trim().length === 0) {
    errors.push("Import tool name is required.");
  }

  return { ok: errors.length === 0, errors };
}

function defineImportWorkflow(
  tool: ScientificToolId,
  acceptedFormats: readonly ImportFormat[],
  instructions: string,
): ImportWorkflowDefinition {
  return {
    tool,
    acceptedFormats,
    instructions,
    validateFormat(payload: ImportPayload): ImportValidationResult {
      if (payload.tool !== tool) {
        return {
          ok: false,
          errors: [
            `Import payload tool "${payload.tool}" does not match workflow "${tool}".`,
          ],
        };
      }
      return formatCheck(payload, acceptedFormats);
    },
  };
}

const IMPORT_WORKFLOWS: Record<string, ImportWorkflowDefinition> = {
  sprite: defineImportWorkflow(
    "sprite",
    ["text", "tsv", "csv", "json"],
    "Optional fallback: if live Worker-proxied SPRITE is down, import a legitimate GrAfSS SPRITE export. The platform will not invent SPRITE hits. Prefer the live Run SPRITE button so students never open grafss.ukm.my.",
  ),
  blast: defineImportWorkflow(
    "blast",
    ["text", "json", "xml", "tsv"],
    "Optional fallback: if live Worker-proxied NCBI BLAST is down, import a legitimate BLAST export. The platform will not invent BLAST hits. Prefer the live Run BLAST button so students never open blast.ncbi.nlm.nih.gov.",
  ),
  interpro: defineImportWorkflow(
    "interpro",
    ["json", "tsv", "text"],
    "If the live InterPro REST lookup fails, export InterProScan / InterPro results from a legitimate source and import them here. Annotations are not invented. Prefer the live UniProt accession lookup when available.",
  ),
  clean: defineImportWorkflow(
    "clean",
    ["text", "json", "tsv"],
    "Live CLEAN is unavailable after honest API probing (MMLi backends 404 / hCaptcha). Import a legitimate CLEAN export. EC numbers are never invented.",
  ),
  dali: defineImportWorkflow(
    "dali",
    ["text", "tsv", "json"],
    "Optional fallback: if live Worker-proxied Dali is down, import a legitimate Dali summary. Z-scores are never invented. Prefer the live Run Dali button.",
  ),
  foldseek: defineImportWorkflow(
    "foldseek",
    ["text", "tsv", "json"],
    "Import Foldseek output from a legitimate search. Hits are not fabricated.",
  ),
  swissdock: defineImportWorkflow(
    "swissdock",
    ["text", "json"],
    "Optional fallback: if live SwissDock (:8443) is unreachable, import a legitimate session export. Poses are never invented. Prefer the live Run SwissDock button.",
  ),
};

export function getImportWorkflow(
  toolId: string,
): ImportWorkflowDefinition | null {
  return IMPORT_WORKFLOWS[toolId] ?? null;
}

export function listImportWorkflows(): ImportWorkflowDefinition[] {
  return Object.values(IMPORT_WORKFLOWS);
}
