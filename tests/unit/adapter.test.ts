import { describe, expect, it } from "vitest";
import {
  createNotImplementedAdapter,
  ScientificAdapterNotImplementedError,
} from "@/adapters/scientificAdapter";

describe("scientific adapter interface", () => {
  it("refuses to invent tool output", async () => {
    const adapter = createNotImplementedAdapter("BLAST");
    await expect(adapter.run({})).rejects.toBeInstanceOf(
      ScientificAdapterNotImplementedError,
    );
    expect(() => adapter.normalize({} as never)).toThrow(
      ScientificAdapterNotImplementedError,
    );
    expect(adapter.getProvenance().source).toBe("not_implemented");
  });
});
