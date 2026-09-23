import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { aiConversations, moduleRuns } from "@/db/schema";
import { createId, nowIso, parseJson } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import {
  getModuleRun,
  listModuleRunsForProject,
} from "@/lib/db/queries/moduleRuns";
import { ServiceError } from "@/lib/services/projectService";
import { listEvidenceForProject } from "@/lib/services/evidenceService";
import { getHypothesisForProject } from "@/lib/services/hypothesisService";
import {
  buildShannonBotSystemPrompt,
  generateShannonBotReply,
  toLlmMessages,
  type ShannonBotMessage,
} from "@/ai/shannonBot";
import {
  chatWithShannonBotProviders,
  describeMissingAiKeys,
  hasShannonBotApiKey,
  readShannonBotEnvKeys,
} from "@/ai/providers";

export interface ShannonBotConversation {
  id: string;
  projectId: string;
  messages: ShannonBotMessage[];
  mode: "local" | "llm";
  provider: string | null;
  blocker: string | null;
  notice: string | null;
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
  const hasKey = hasShannonBotApiKey(readShannonBotEnvKeys());
  const blocker = hasKey ? null : describeMissingAiKeys();

  if (rows.length === 0) {
    return {
      id: "",
      projectId,
      messages: [],
      mode: "local",
      provider: null,
      blocker,
      notice: null,
    };
  }
  return {
    id: rows[0].id,
    projectId,
    messages: parseJson<ShannonBotMessage[]>(rows[0].messagesJson, []),
    mode: "local",
    provider: null,
    blocker,
    notice: null,
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

  const context = {
    evidence,
    hypothesis: hypothesisPayload.hypothesis,
    moduleStatuses: moduleRunsList.map((run) => ({
      moduleId: run.moduleId,
      status: run.status,
    })),
  };

  const existing = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.projectId, projectId))
    .limit(1);
  const priorMessages =
    existing.length === 0
      ? []
      : parseJson<ShannonBotMessage[]>(existing[0].messagesJson, []);

  const keys = readShannonBotEnvKeys();
  const hasKey = hasShannonBotApiKey(keys);
  const localReply = generateShannonBotReply(text, context);

  let replyContent = localReply;
  let mode: "local" | "llm" = "local";
  let provider: string | null = null;
  let notice: string | null = null;
  const blocker = hasKey ? null : describeMissingAiKeys();

  if (hasKey) {
    const llmResult = await chatWithShannonBotProviders(
      {
        messages: toLlmMessages(
          priorMessages,
          buildShannonBotSystemPrompt(context),
          text,
        ),
      },
      keys,
    );
    if (llmResult.ok) {
      replyContent = llmResult.content;
      mode = "llm";
      provider = llmResult.provider;
    } else {
      notice = llmResult.message;
    }
  }

  const timestamp = nowIso();
  const studentMessage: ShannonBotMessage = {
    role: "student",
    content: text,
    createdAt: timestamp,
  };
  const reply: ShannonBotMessage = {
    role: "shannonbot",
    content: replyContent,
    createdAt: nowIso(),
  };

  let messages: ShannonBotMessage[];
  let id: string;
  if (existing.length === 0) {
    id = createId();
    messages = [studentMessage, reply];
    await db.insert(aiConversations).values({
      id,
      projectId,
      messagesJson: JSON.stringify(messages),
      evidenceReferencesJson: JSON.stringify(evidence.map((item) => item.id)),
      createdAt: timestamp,
    });
  } else {
    id = existing[0].id;
    messages = [...priorMessages, studentMessage, reply];
    await db
      .update(aiConversations)
      .set({
        messagesJson: JSON.stringify(messages),
        evidenceReferencesJson: JSON.stringify(evidence.map((item) => item.id)),
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
    mode,
    provider,
    blocker,
    notice,
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
