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
import { InterProDataAdapter } from "@/adapters/interpro";

describe("adapter registry", () => {
  it("exposes RCSB and InterPro as live adapters", () => {
    const tools = listScientificTools();
    const live = tools.filter((tool) => tool.liveAdapter);
    expect(live.map((tool) => tool.id).sort()).toEqual(["interpro", "rcsb"]);
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

  it("returns the live InterPro adapter from the registry", () => {
    const adapter = getScientificAdapter("interpro");
    expect(adapter).toBeInstanceOf(InterProDataAdapter);
  });

  it("keeps import workflows for stub tools and InterPro fallback", () => {
    const blastImport = getImportWorkflowForTool("blast");
    expect(blastImport).not.toBeNull();
    expect(blastImport?.instructions.toLowerCase()).toContain("import");

    const interproImport = getImportWorkflowForTool("interpro");
    expect(interproImport).not.toBeNull();

    const rcsbImport = getImportWorkflowForTool("rcsb");
    expect(rcsbImport).toBeNull();
  });
});
