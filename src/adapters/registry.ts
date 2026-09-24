import {
  createNotImplementedAdapter,
  type ScientificAdapter,
} from "@/adapters/scientificAdapter";
import { createRcsbDataAdapter } from "@/adapters/rcsb";
import { createInterProDataAdapter } from "@/adapters/interpro";
import { createFoldseekSearchAdapter } from "@/adapters/foldseek";
import { createSpriteSearchAdapter } from "@/adapters/sprite";
import { createBlastSearchAdapter } from "@/adapters/blast";
import { createDaliSearchAdapter } from "@/adapters/dali";
import { createSwissDockSearchAdapter } from "@/adapters/swissdock";
import type { ImportWorkflowDefinition } from "@/types/importWorkflow";
import { getImportWorkflow } from "@/adapters/import/workflows";

/**
 * Tools known to the platform.
 * RCSB + InterPro + Foldseek + SPRITE + BLAST + Dali + CLEAN + SwissDock are live (CLEAN via cleanService, health-checked); others are stubs or import-only.
 */
export const SCIENTIFIC_TOOL_IDS = [
  "rcsb",
  "sprite",
  "blast",
  "interpro",
  "clean",
  "dali",
  "foldseek",
  "swissdock",
] as const;

export type ScientificToolId = (typeof SCIENTIFIC_TOOL_IDS)[number];

export interface ScientificToolRegistration {
  id: ScientificToolId;
  displayName: string;
  /** Live adapter available (verified API). */
  liveAdapter: boolean;
  /** Structured import scaffolding available. */
  importSupported: boolean;
  /** Curriculum module id when applicable (null for infrastructure-only tools like RCSB). */
  moduleId: string | null;
}

export const SCIENTIFIC_TOOL_REGISTRY: readonly ScientificToolRegistration[] = [
  {
    id: "rcsb",
    displayName: "RCSB PDB Data API",
    liveAdapter: true,
    importSupported: false,
    moduleId: "pdb-setup",
  },
  {
    id: "sprite",
    displayName: "SPRITE",
    liveAdapter: true,
    importSupported: true,
    moduleId: "sprite",
  },
  {
    id: "blast",
    displayName: "BLAST",
    liveAdapter: true,
    importSupported: true,
    moduleId: "blast",
  },
  {
    id: "interpro",
    displayName: "InterPro",
    liveAdapter: true,
    importSupported: true,
    moduleId: "interpro",
  },
  {
    id: "clean",
    displayName: "CLEAN",
    liveAdapter: true,
    importSupported: true,
    moduleId: "clean",
  },
  {
    id: "dali",
    displayName: "Dali",
    liveAdapter: true,
    importSupported: true,
    moduleId: "dali",
  },
  {
    id: "foldseek",
    displayName: "Foldseek",
    liveAdapter: true,
    importSupported: true,
    moduleId: "foldseek",
  },
  {
    id: "swissdock",
    displayName: "SwissDock",
    liveAdapter: true,
    importSupported: true,
    moduleId: "swissdock",
  },
] as const;

export function getToolRegistration(
  id: string,
): ScientificToolRegistration | undefined {
  return SCIENTIFIC_TOOL_REGISTRY.find((tool) => tool.id === id);
}

/**
 * Returns a live adapter where verified, otherwise a stub that throws
 * ScientificAdapterNotImplementedError. Never invents scientific payloads.
 */
export function getScientificAdapter(
  toolId: string,
): ScientificAdapter<unknown, unknown, unknown> {
  const registration = getToolRegistration(toolId);
  if (!registration) {
    return createNotImplementedAdapter(toolId);
  }

  if (registration.id === "rcsb" && registration.liveAdapter) {
    return createRcsbDataAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "interpro" && registration.liveAdapter) {
    return createInterProDataAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "foldseek" && registration.liveAdapter) {
    return createFoldseekSearchAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "sprite" && registration.liveAdapter) {
    return createSpriteSearchAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "blast" && registration.liveAdapter) {
    return createBlastSearchAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "dali" && registration.liveAdapter) {
    return createDaliSearchAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  if (registration.id === "swissdock" && registration.liveAdapter) {
    return createSwissDockSearchAdapter() as ScientificAdapter<
      unknown,
      unknown,
      unknown
    >;
  }

  return createNotImplementedAdapter(registration.displayName);
}

export function getImportWorkflowForTool(
  toolId: string,
): ImportWorkflowDefinition | null {
  const registration = getToolRegistration(toolId);
  if (!registration?.importSupported) {
    return null;
  }
  return getImportWorkflow(registration.id);
}

export function listScientificTools(): readonly ScientificToolRegistration[] {
  return SCIENTIFIC_TOOL_REGISTRY;
}
