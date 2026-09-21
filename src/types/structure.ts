export const STRUCTURE_SOURCES = [
  "student_input",
  "rcsb",
  "demo",
  "import",
] as const;

export type StructureSource = (typeof STRUCTURE_SOURCES)[number];

export interface PdbStructure {
  id: string;
  projectId: string;
  pdbId: string;
  title: string | null;
  organism: string | null;
  chains: string[] | null;
  sequence: string | null;
  metadata: Record<string, unknown> | null;
  source: StructureSource;
  retrievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
