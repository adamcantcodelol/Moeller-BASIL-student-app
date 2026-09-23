import { describe, expect, it } from "vitest";
import { reviewStudentHypothesis } from "@/lib/hypothesis/reviewHypothesis";

describe("reviewStudentHypothesis", () => {
  it("does not author a hypothesis and flags thin claims", () => {
    const review = reviewStudentHypothesis("too short");
    expect(review.checks.some((check) => !check.passed)).toBe(true);
    expect(review.guidance.join(" ")).not.toMatch(/I think residue/i);
  });

  it("passes a specific evidence-linked claim", () => {
    const review = reviewStudentHypothesis(
      "If the InterPro domain evidence is correct, I predict the catalytic histidine residue is essential because homologs from BLAST conserve that position.",
    );
    expect(review.checks.every((check) => check.passed)).toBe(true);
  });
});
