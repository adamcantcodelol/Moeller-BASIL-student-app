import { describe, expect, it } from "vitest";
import {
  CURRICULUM_MODULES,
  getImplementedModuleIds,
  getModuleBySlug,
} from "@/modules/registry";

describe("curriculum registry", () => {
  it("contains modules 00 through 11 in order", () => {
    expect(CURRICULUM_MODULES).toHaveLength(12);
    expect(CURRICULUM_MODULES.map((module) => module.number)).toEqual([
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
    ]);
  });

  it("marks Phase 4 scientific tools implemented", () => {
    expect(getImplementedModuleIds()).toEqual([
      "pdb-setup",
      "sprite",
      "blast",
      "interpro",
      "clean",
      "dali",
      "foldseek",
      "swissdock",
    ]);
    expect(getModuleBySlug("active-site-evidence")?.implemented).toBe(false);
    expect(getModuleBySlug("foldseek")?.implemented).toBe(true);
  });
});
