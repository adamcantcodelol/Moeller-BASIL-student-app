export interface Provenance {
  tool: string;
  source: string;
  retrievedAt: string;
  parameters: Record<string, unknown>;
  rawResultId: string | null;
  version: string | null;
}
