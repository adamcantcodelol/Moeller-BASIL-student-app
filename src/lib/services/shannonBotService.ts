import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { aiConversations, moduleRuns } from "@/db/schema";
import { createId, nowIso, parseJson } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { listModuleRunsForProject } from "@/lib/db/queries/moduleRuns";
import { ServiceError } from "@/lib/services/projectService";
import { listEvidenceForProject } from "@/lib/services/evidenceService";
import { getHypothesisForProject } from "@/lib/services/hypothesisService";
import {
  generateShannonBotReply,
  type ShannonBotMessage,
} from "@/ai/shannonBot";

export interface ShannonBotConversation {
  id: string;
  projectId: string;
  messages: ShannonBotMessage[];
  mode: "local" | "llm";
  blocker: string | null;
}

function readEnvKey(): string | null {
  const key =
    process.env.GROQ_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.SHANNONBOT_API_KEY?.trim() ||
    null;
  return key && key.length > 0 ? key : null;
}

export async function getShannonBotConversation(
  db: AppDatabase,
  projectId: string,
): Promise<ShannonBotConversation> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const rows = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.projectId, projectId))
    .limit(1);
  const key = readEnvKey();
  const blocker = key
    ? null
    : "No free-tier AI API key configured (set GROQ_API_KEY or OPENROUTER_API_KEY server-side). ShannonBot is running in local Socratic mode and will not invent scientific results.";

  if (rows.length === 0) {
    return {
      id: "",
      projectId,
      messages: [],
      mode: "local",
      blocker,
    };
  }
  return {
    id: rows[0].id,
    projectId,
    messages: parseJson<ShannonBotMessage[]>(rows[0].messagesJson, []),
    mode: "local",
    blocker,
  };
}

export async function sendShannonBotMessage(
  db: AppDatabase,
  projectId: string,
  content: string,
): Promise<ShannonBotConversation> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const text = content.trim();
  if (!text) {
    throw new ServiceError("Message cannot be empty.", 400);
  }

  const [evidence, hypothesisPayload, moduleRunsList] = await Promise.all([
    listEvidenceForProject(db, projectId),
    getHypothesisForProject(db, projectId),
    listModuleRunsForProject(db, projectId),
  ]);

  const timestamp = nowIso();
  const studentMessage: ShannonBotMessage = {
    role: "student",
    content: text,
    createdAt: timestamp,
  };
  const reply: ShannonBotMessage = {
    role: "shannonbot",
    content: generateShannonBotReply(text, {
      evidence,
      hypothesis: hypothesisPayload.hypothesis,
      moduleStatuses: moduleRunsList.map((run) => ({
        moduleId: run.moduleId,
        status: run.status,
      })),
    }),
    createdAt: nowIso(),
  };

  const existing = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.projectId, projectId))
    .limit(1);

  let messages: ShannonBotMessage[];
  let id: string;
  if (existing.length === 0) {
    id = createId();
    messages = [studentMessage, reply];
    await db.insert(aiConversations).values({
      id,
      projectId,
      messagesJson: JSON.stringify(messages),
      evidenceReferencesJson: JSON.stringify(
        evidence.map((item) => item.id),
      ),
      createdAt: timestamp,
    });
  } else {
    id = existing[0].id;
    messages = [
      ...parseJson<ShannonBotMessage[]>(existing[0].messagesJson, []),
      studentMessage,
      reply,
    ];
    await db
      .update(aiConversations)
      .set({
        messagesJson: JSON.stringify(messages),
        evidenceReferencesJson: JSON.stringify(
          evidence.map((item) => item.id),
        ),
      })
      .where(eq(aiConversations.id, id));
  }

  const run = await getModuleRun(db, projectId, "shannonbot-review");
  if (run && run.status !== "complete") {
    await db
      .update(moduleRuns)
      .set({
        status: "in_progress",
        startedAt: run.startedAt ?? timestamp,
        error: null,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));
  }

  return {
    id,
    projectId,
    messages,
    mode: "local",
    blocker: readEnvKey()
      ? null
      : "No free-tier AI API key configured (set GROQ_API_KEY or OPENROUTER_API_KEY server-side). ShannonBot is running in local Socratic mode and will not invent scientific results.",
  };
}

export async function completeShannonBotModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const conversation = await getShannonBotConversation(db, projectId);
  if (conversation.messages.length < 2) {
    throw new ServiceError(
      "Have a short ShannonBot exchange before completing this module.",
      400,
    );
  }
  const run = await getModuleRun(db, projectId, "shannonbot-review");
  if (!run) {
    throw new ServiceError("ShannonBot module run is missing.", 500);
  }
  const timestamp = nowIso();
  await db
    .update(moduleRuns)
    .set({
      status: "complete",
      completedAt: timestamp,
      startedAt: run.startedAt ?? timestamp,
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, run.id));
  return { runId: run.id, status: "complete" };
}
