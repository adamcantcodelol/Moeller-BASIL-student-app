import { describe, expect, it } from "vitest";
import {
  getImportWorkflowForTool,
  getScientificAdapter,
  listScientificTools,
} from "@/adapters/registry";
import {
  createAllStubAdapters,
  STUB_TOOL_IDS,
} from "@/adapters/stubs";
import { ScientificAdapterNotImplementedError } from "@/adapters/scientificAdapter";

describe("adapter registry", () => {
  it("exposes RCSB as the only live adapter in Phase 3", () => {
    const tools = listScientificTools();
    const live = tools.filter((tool) => tool.liveAdapter);
    expect(live.map((tool) => tool.id)).toEqual(["rcsb"]);
  });

  it("returns stubs that refuse to invent results", async () => {
    const stubs = createAllStubAdapters();
    expect(Object.keys(stubs).sort()).toEqual([...STUB_TOOL_IDS].sort());

    for (const toolId of STUB_TOOL_IDS) {
      const adapter = getScientificAdapter(toolId);
      await expect(adapter.run({})).rejects.toBeInstanceOf(
        ScientificAdapterNotImplementedError,
      );
    }
  });

  it("provides import workflow scaffolding without claiming live APIs", () => {
    const blastImport = getImportWorkflowForTool("blast");
    expect(blastImport).not.toBeNull();
    expect(blastImport?.instructions).toContain("not claimed");

    const rcsbImport = getImportWorkflowForTool("rcsb");
    expect(rcsbImport).toBeNull();
  });
});
