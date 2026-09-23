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
import { FoldseekSearchAdapter } from "@/adapters/foldseek";
import { SpriteSearchAdapter } from "@/adapters/sprite";

describe("adapter registry", () => {
  it("exposes RCSB, InterPro, Foldseek, and SPRITE as live adapters", () => {
    const tools = listScientificTools();
    const live = tools.filter((tool) => tool.liveAdapter);
    expect(live.map((tool) => tool.id).sort()).toEqual([
      "foldseek",
      "interpro",
      "rcsb",
      "sprite",
    ]);
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

  it("returns live InterPro, Foldseek, and SPRITE adapters", () => {
    expect(getScientificAdapter("interpro")).toBeInstanceOf(InterProDataAdapter);
    expect(getScientificAdapter("foldseek")).toBeInstanceOf(FoldseekSearchAdapter);
    expect(getScientificAdapter("sprite")).toBeInstanceOf(SpriteSearchAdapter);
  });

  it("keeps import workflows for import-capable tools", () => {
    expect(getImportWorkflowForTool("blast")).not.toBeNull();
    expect(getImportWorkflowForTool("interpro")).not.toBeNull();
    expect(getImportWorkflowForTool("foldseek")).not.toBeNull();
    expect(getImportWorkflowForTool("sprite")).not.toBeNull();
    expect(getImportWorkflowForTool("rcsb")).toBeNull();
  });
});
