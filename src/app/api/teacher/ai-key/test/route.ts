import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { teacherGuard } from "@/lib/auth/request";
import {
  AI_PROVIDER_LABELS,
  getSettingsSecret,
  isAiKeyProvider,
  loadSavedAiKeys,
  providerForTest,
} from "@/lib/settings/aiKeys";

export const dynamic = "force-dynamic";

/** Teacher only. One tiny real chat call with the saved (else env) key. */
export async function POST(request: Request) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
    const provider = body?.provider;
    if (!isAiKeyProvider(provider)) return jsonError("Unknown provider.", 400);
    const saved = await loadSavedAiKeys(await getRequestDatabase(), await getSettingsSecret());
    const target = providerForTest(provider, saved);
    const label = AI_PROVIDER_LABELS[provider];
    if (!target) {
      return Response.json({ ok: false, message: `No ${label} key is saved or configured.` });
    }
    const result = await target.provider.chat({
      messages: [{ role: "user", content: "Reply with the single word: OK" }],
      maxTokens: 5,
      timeoutMs: 10_000,
    });
    const sourceText = target.source === "saved" ? "teacher-saved key" : "server env key";
    if (result.ok) {
      return Response.json({
        ok: true,
        source: target.source,
        message: `${label} responded using the ${sourceText} (model ${result.model}).`,
      });
    }
    return Response.json({
      ok: false,
      source: target.source,
      message: `${label} test failed with the ${sourceText}: ${result.message.replace(/ Falling back to local Socratic mode\.$/, "")}`,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
