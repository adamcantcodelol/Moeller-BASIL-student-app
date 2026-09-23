import type { HypothesisCheck, HypothesisReview } from "@/types/hypothesis";

/**
 * Lightweight, non-generative review. Never writes a hypothesis for the student.
 */
export function reviewStudentHypothesis(text: string): HypothesisReview {
  const trimmed = text.trim();
  const checks: HypothesisCheck[] = [
    {
      id: "non_empty",
      label: "Non-empty",
      passed: trimmed.length > 0,
      detail: trimmed.length > 0 ? "Hypothesis text is present." : "Write a hypothesis first.",
    },
    {
      id: "specific",
      label: "Specific enough",
      passed: trimmed.length >= 40,
      detail:
        trimmed.length >= 40
          ? "Long enough to state a specific claim."
          : "Add enough detail to make a specific, testable claim (aim for ≥40 characters).",
    },
    {
      id: "testable",
      label: "Sounds testable",
      passed: /\b(if|because|predict|would|should|expect|residue|active\s*site|cataly)/i.test(
        trimmed,
      ),
      detail:
        /\b(if|because|predict|would|should|expect|residue|active\s*site|cataly)/i.test(trimmed)
          ? "Uses language that can support a testable claim."
          : "Consider framing a prediction (e.g. what residue/function you expect and why).",
    },
    {
      id: "evidence_linked",
      label: "Mentions evidence context",
      passed: /\b(interpro|blast|foldseek|dali|sprite|clean|dock|domain|homolog|structure|sequence|evidence)/i.test(
        trimmed,
      ),
      detail:
        /\b(interpro|blast|foldseek|dali|sprite|clean|dock|domain|homolog|structure|sequence|evidence)/i.test(
          trimmed,
        )
          ? "References computational/scientific context."
          : "Cite which module evidence supports your claim (without inventing results).",
    },
  ];

  const guidance: string[] = [];
  for (const check of checks) {
    if (!check.passed) {
      guidance.push(check.detail);
    }
  }
  if (guidance.length === 0) {
    guidance.push(
      "Checks look reasonable. Re-read your evidence list and confirm every claim maps to a real module result.",
    );
  }

  return { checks, guidance };
}
