import { nowIso } from "@/lib/ids";
import type { Provenance } from "@/types/provenance";
import { ScientificError } from "@/adapters/errors";

export interface BuildProvenanceInput {
  tool: string;
  source: string;
  parameters?: Record<string, unknown>;
  rawResultId?: string | null;
  version?: string | null;
  retrievedAt?: string;
}

/** Creates a consistent provenance record for every scientific result. */
export function buildProvenance(input: BuildProvenanceInput): Provenance {
  if (!input.tool.trim()) {
    throw new ScientificError(
      "VALIDATION",
      "Provenance requires a non-empty tool name.",
    );
  }
  if (!input.source.trim()) {
    throw new ScientificError(
      "VALIDATION",
      "Provenance requires a non-empty source.",
    );
  }

  return {
    tool: input.tool,
    source: input.source,
    retrievedAt: input.retrievedAt ?? nowIso(),
    parameters: input.parameters ?? {},
    rawResultId: input.rawResultId ?? null,
    version: input.version ?? null,
  };
}

export function withRawResultId(
  provenance: Provenance,
  rawResultId: string,
): Provenance {
  return { ...provenance, rawResultId };
}

export function assertProvenance(value: unknown): Provenance {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ScientificError(
      "VALIDATION",
      "Provenance must be an object.",
    );
  }
  const record = value as Record<string, unknown>;
  if (typeof record.tool !== "string" || !record.tool.trim()) {
    throw new ScientificError("VALIDATION", "Provenance.tool is required.");
  }
  if (typeof record.source !== "string" || !record.source.trim()) {
    throw new ScientificError("VALIDATION", "Provenance.source is required.");
  }
  if (typeof record.retrievedAt !== "string") {
    throw new ScientificError(
      "VALIDATION",
      "Provenance.retrievedAt must be a string.",
    );
  }
  if (
    record.parameters === null ||
    typeof record.parameters !== "object" ||
    Array.isArray(record.parameters)
  ) {
    throw new ScientificError(
      "VALIDATION",
      "Provenance.parameters must be an object.",
    );
  }
  if (
    record.rawResultId !== null &&
    typeof record.rawResultId !== "string"
  ) {
    throw new ScientificError(
      "VALIDATION",
      "Provenance.rawResultId must be a string or null.",
    );
  }
  if (record.version !== null && typeof record.version !== "string") {
    throw new ScientificError(
      "VALIDATION",
      "Provenance.version must be a string or null.",
    );
  }

  return {
    tool: record.tool,
    source: record.source,
    retrievedAt: record.retrievedAt,
    parameters: record.parameters as Record<string, unknown>,
    rawResultId: record.rawResultId as string | null,
    version: record.version as string | null,
  };
}

/** Import results must never claim to be live adapter output. */
export function buildImportProvenance(input: {
  tool: string;
  parameters?: Record<string, unknown>;
  rawResultId?: string | null;
  format?: string;
}): Provenance {
  return buildProvenance({
    tool: input.tool,
    source: "import",
    parameters: {
      ...input.parameters,
      importFormat: input.format ?? null,
    },
    rawResultId: input.rawResultId ?? null,
    version: null,
  });
}
