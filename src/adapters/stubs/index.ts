import {
  createNotImplementedAdapter,
  type ScientificAdapter,
} from "@/adapters/scientificAdapter";
import {
  SCIENTIFIC_TOOL_REGISTRY,
  type ScientificToolId,
} from "@/adapters/registry";

const STUB_TOOL_IDS = SCIENTIFIC_TOOL_REGISTRY.filter(
  (tool) => !tool.liveAdapter,
).map((tool) => tool.id);

/**
 * Explicit stubs for tools without a live adapter. Each throws
 * ScientificAdapterNotImplementedError rather than claiming BLAST/etc. work.
 */
export function createStubAdapter(
  toolId: ScientificToolId | string,
): ScientificAdapter<unknown, never, never> {
  const registration = SCIENTIFIC_TOOL_REGISTRY.find((t) => t.id === toolId);
  const name = registration?.displayName ?? toolId;
  return createNotImplementedAdapter(name);
}

export function createAllStubAdapters(): Record<
  string,
  ScientificAdapter<unknown, never, never>
> {
  const stubs: Record<string, ScientificAdapter<unknown, never, never>> = {};
  for (const id of STUB_TOOL_IDS) {
    stubs[id] = createStubAdapter(id);
  }
  return stubs;
}

export { STUB_TOOL_IDS };
