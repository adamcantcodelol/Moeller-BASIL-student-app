export const IMPORT_FORMATS = ["json", "text", "tsv", "csv", "xml"] as const;

export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export interface ImportPayload {
  tool: string;
  format: ImportFormat;
  /** Raw student-provided content. Stored as-is; never replaced with fabricated science. */
  content: string;
  notes?: string;
}

export interface ImportValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ImportWorkflowDefinition {
  tool: string;
  acceptedFormats: readonly ImportFormat[];
  instructions: string;
  /**
   * Phase 3: format / non-empty checks only.
   * Tool-specific parsing belongs in Phase 4 after verification.
   */
  validateFormat(payload: ImportPayload): ImportValidationResult;
}
