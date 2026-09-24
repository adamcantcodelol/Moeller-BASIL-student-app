import { z } from "zod";
import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { teacherGuard } from "@/lib/auth/request";
import {
  getAiKeyStatus,
  getSettingsSecret,
  isAiKeyProvider,
  removeAiKey,
  saveAiKey,
  validateAiKey,
} from "@/lib/settings/aiKeys";

export const dynamic = "force-dynamic";

async function statusResponse() {
  const db = await getRequestDatabase();
  return Response.json(
    { keys: await getAiKeyStatus(db, await getSettingsSecret()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Teacher only. Masked status of saved ShannonBot keys (never the key itself). */
export async function GET() {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    return await statusResponse();
  } catch (error) {
    return handleServiceError(error);
  }
}

const putSchema = z.object({
  provider: z.enum(["groq", "openrouter"]),
  apiKey: z.string().trim().min(1),
});

/** Teacher only. Save or replace the key for one provider. */
export async function PUT(request: Request) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const parsed = putSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose a provider and paste a key.", 400);
    const { provider, apiKey } = parsed.data;
    const invalid = validateAiKey(provider, apiKey);
    if (invalid) return jsonError(invalid, 400);
    const secret = await getSettingsSecret();
    if (!secret) return jsonError("Server is missing TEACHER_PASSWORD; cannot store keys.", 500);
    await saveAiKey(await getRequestDatabase(), provider, apiKey, secret);
    return await statusResponse();
  } catch (error) {
    return handleServiceError(error);
  }
}

/** Teacher only. Remove a saved key: DELETE /api/teacher/ai-key?provider=groq */
export async function DELETE(request: Request) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const provider = new URL(request.url).searchParams.get("provider");
    if (!isAiKeyProvider(provider)) return jsonError("Unknown provider.", 400);
    await removeAiKey(await getRequestDatabase(), provider);
    return await statusResponse();
  } catch (error) {
    return handleServiceError(error);
  }
}
