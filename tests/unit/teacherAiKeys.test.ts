import { describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { openSecret, sealSecret } from "@/lib/settings/secretBox";
import {
  buildShannonBotProviders,
  getAiKeyStatus,
  loadSavedAiKeys,
  providerForTest,
  removeAiKey,
  saveAiKey,
  validateAiKey,
} from "@/lib/settings/aiKeys";
import { readShannonBotEnvKeys } from "@/ai/providers";

const SECRET = "teacher-secret-for-tests";
const GROQ_KEY = "gsk_test_1234567890abcdWXYZ";

describe("secret box", () => {
  it("round-trips and rejects the wrong secret", async () => {
    const sealed = await sealSecret("hello", SECRET);
    expect(sealed).not.toContain("hello");
    expect(await openSecret(sealed, SECRET)).toBe("hello");
    expect(await openSecret(sealed, "other")).toBeNull();
    expect(await openSecret("garbage", SECRET)).toBeNull();
  });
});

describe("teacher AI keys", () => {
  it("saves encrypted, reports masked status, replaces and removes", async () => {
    const db = await createTestDatabase();
    const env = readShannonBotEnvKeys({});
    await saveAiKey(db, "groq", GROQ_KEY, SECRET);

    const status = await getAiKeyStatus(db, SECRET, env);
    const groq = status.find((s) => s.provider === "groq")!;
    expect(groq).toMatchObject({ saved: true, masked: "••••WXYZ", readable: true });
    expect(JSON.stringify(status)).not.toContain(GROQ_KEY);
    expect(status.find((s) => s.provider === "openrouter")!.saved).toBe(false);

    expect((await loadSavedAiKeys(db, SECRET)).groq).toBe(GROQ_KEY);
    expect(await loadSavedAiKeys(db, "rotated")).toEqual({});
    expect((await getAiKeyStatus(db, "rotated", env))[0].readable).toBe(false);

    await saveAiKey(db, "groq", "gsk_replacement_key_0000", SECRET);
    expect((await loadSavedAiKeys(db, SECRET)).groq).toBe("gsk_replacement_key_0000");

    await removeAiKey(db, "groq");
    expect(await loadSavedAiKeys(db, SECRET)).toEqual({});
  });

  it("orders teacher-saved keys before env fallback keys", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization") ?? "";
      calls.push(auth);
      if (auth.endsWith("saved-groq-key-1234")) {
        return new Response("nope", { status: 401 });
      }
      return Response.json({ choices: [{ message: { content: "What evidence?" } }] });
    }) as unknown as typeof fetch;
    const env = readShannonBotEnvKeys({ GROQ_API_KEY: "env-groq-key-5678" });
    const providers = buildShannonBotProviders({ groq: "saved-groq-key-1234" }, env, fetchImpl);
    expect(providers.map((p) => p.id)).toEqual(["groq", "groq"]);
    const { chatWithProviderList } = await import("@/ai/providers");
    const result = await chatWithProviderList({ messages: [{ role: "user", content: "hi" }] }, providers);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["Bearer saved-groq-key-1234", "Bearer env-groq-key-5678"]);

    expect(buildShannonBotProviders({}, readShannonBotEnvKeys({}))).toHaveLength(0);
    expect(providerForTest("openrouter", {}, readShannonBotEnvKeys({}))).toBeNull();
    expect(providerForTest("groq", { groq: "k" }, env)?.source).toBe("saved");
    expect(providerForTest("groq", {}, env)?.source).toBe("env");
  });

  it("validates obvious wrong pastes", () => {
    expect(validateAiKey("groq", GROQ_KEY)).toBeNull();
    expect(validateAiKey("groq", "sk-or-v1-abcdefghijkl")).toMatch(/OpenRouter/);
    expect(validateAiKey("openrouter", GROQ_KEY)).toMatch(/Groq/);
    expect(validateAiKey("groq", "short")).not.toBeNull();
  });
});
