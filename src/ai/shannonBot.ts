import type { LlmChatMessage } from "@/ai/providers/types";
import type { Evidence } from "@/types/evidence";
import type { Hypothesis } from "@/types/hypothesis";

export interface ShannonBotMessage {
  role: "student" | "shannonbot" | "system";
  content: string;
  createdAt: string;
}

export interface ShannonBotContext {
  evidence: Evidence[];
  hypothesis: Hypothesis | null;
  moduleStatuses: Array<{ moduleId: string; status: string }>;
}

function summarizeEvidence(evidence: Evidence[]): string {
  if (evidence.length === 0) {
    return "No evidence residues have been recorded yet.";
  }
  return evidence
    .slice(0, 8)
    .map((item) => {
      const residues =
        item.residues
          ?.map(
            (residue) =>
              `${residue.chain ? `${residue.chain}:` : ""}${residue.position}`,
          )
          .join(", ") ?? "no residues";
      return `- [${item.sourceModuleId}] ${item.description} (${residues}; ${item.strength ?? "unspecified"})`;
    })
    .join("\n");
}

/**
 * Deterministic free mentor. Uses only provided context — never invents residues
 * or tool hits. Optional cloud LLM uses the same system prompt; on failure we
 * fall back here.
 */
export function generateShannonBotReply(
  studentMessage: string,
  context: ShannonBotContext,
): string {
  const message = studentMessage.trim();
  const evidenceSummary = summarizeEvidence(context.evidence);
  const hypothesisText = context.hypothesis?.text?.trim() || null;

  if (!message) {
    return "What part of your analysis would you like to examine? Point to a specific module result or residue you recorded.";
  }

  if (/\b(residue|position|aa|amino)\b/i.test(message)) {
    if (context.evidence.length === 0) {
      return "You mentioned a residue, but this project has no recorded evidence residues yet. Which module result supports that position? Record it in Active-Site Evidence Synthesis before treating it as established.";
    }
    return `You referenced a residue. Which recorded evidence supports it?\n\nCurrent evidence on file:\n${evidenceSummary}\n\nIf you cannot point to one of these records, pause and gather module evidence first — I will not invent a residue for you.`;
  }

  if (/\bhypothesis\b/i.test(message)) {
    if (!hypothesisText) {
      return "You have not saved a hypothesis yet. Draft one yourself in Hypothesis Builder, then we can test whether each claim maps to recorded evidence.";
    }
    return `Your saved hypothesis is:\n\n"${hypothesisText}"\n\nWhich clause is supported by which evidence record? If a clause has no matching evidence, revise the hypothesis rather than inventing support.`;
  }

  if (/\b(blast|interpro|foldseek|dali|sprite|clean|dock)\b/i.test(message)) {
    return `When you discuss a tool, stay grounded in what that module actually stored for this project. For residues, use only the evidence list:\n${evidenceSummary}\n\nWhat specific result from that module are you relying on?`;
  }

  return `Let's stay Socratic and evidence-bound. Your recorded evidence is:\n${evidenceSummary}\n\nWhat claim are you making, and which of those records supports it? I will not invent tool outputs or residues.`;
}

export function buildShannonBotSystemPrompt(context: ShannonBotContext): string {
  return [
    "You are ShannonBot, a Socratic mentor for Moeller BASIL students.",
    "Never invent scientific results, residues, literature, or tool outputs.",
    "Only discuss residues present in the provided evidence list.",
    "Do not write the student's final hypothesis for them.",
    "Ask questions that push students back to module evidence.",
    "",
    "Evidence:",
    summarizeEvidence(context.evidence),
    "",
    `Hypothesis: ${context.hypothesis?.text ?? "(none saved)"}`,
  ].join("\n");
}

/** Map stored conversation turns into OpenAI-compatible chat messages. */
export function toLlmMessages(
  history: ShannonBotMessage[],
  systemPrompt: string,
  latestStudentMessage: string,
): LlmChatMessage[] {
  const messages: LlmChatMessage[] = [{ role: "system", content: systemPrompt }];
  for (const turn of history.slice(-8)) {
    if (turn.role === "student") {
      messages.push({ role: "user", content: turn.content });
    } else if (turn.role === "shannonbot") {
      messages.push({ role: "assistant", content: turn.content });
    }
  }
  messages.push({ role: "user", content: latestStudentMessage });
  return messages;
}
