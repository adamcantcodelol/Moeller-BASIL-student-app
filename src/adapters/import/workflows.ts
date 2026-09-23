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
    "Run SPRITE using the BASIL-approved workflow, then import the raw output file or pasted results. The platform will not invent SPRITE hits. Tool-specific parsing lands in Phase 4 after mechanism verification.",
  ),
  blast: defineImportWorkflow(
    "blast",
    ["text", "json", "xml", "tsv"],
    "Obtain BLAST results from a legitimate NCBI or equivalent search, then import the raw output. Do not paste fabricated alignments. Live BLAST automation is not claimed in Phase 3.",
  ),
  interpro: defineImportWorkflow(
    "interpro",
    ["json", "tsv", "text"],
    "Export InterProScan / InterPro results from a legitimate source and import them here. Annotations are not invented.",
  ),
  clean: defineImportWorkflow(
    "clean",
    ["text", "json", "tsv"],
    "Import CLEAN results obtained through a verified legitimate mechanism. Phase 3 stores raw imports only.",
  ),
  dali: defineImportWorkflow(
    "dali",
    ["text", "tsv", "json"],
    "Import Dali structural similarity output from a legitimate run. Matches are not fabricated.",
  ),
  foldseek: defineImportWorkflow(
    "foldseek",
    ["text", "tsv", "json"],
    "Import Foldseek output from a legitimate search. Hits are not fabricated.",
  ),
  swissdock: defineImportWorkflow(
    "swissdock",
    ["text", "json"],
    "Import SwissDock / docking output from a legitimate run. Poses are not invented and remain distinct from experimental structures.",
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
