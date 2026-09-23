import { describe, expect, it, vi } from "vitest";
import {
  chatWithShannonBotProviders,
  readShannonBotEnvKeys,
  resolveShannonBotProviders,
} from "@/ai/providers";
import { createGroqProvider } from "@/ai/providers/groq";
import { createOpenRouterProvider } from "@/ai/providers/openrouter";

describe("ShannonBot LLM providers", () => {
  it("reads env keys without exposing them", () => {
    const keys = readShannonBotEnvKeys({
      GROQ_API_KEY: " groq-test ",
      OPENROUTER_API_KEY: "",
      SHANNONBOT_PROVIDER: "groq",
    });
    expect(keys.groqApiKey).toBe("groq-test");
    expect(keys.openRouterApiKey).toBeNull();
    expect(keys.preferredProvider).toBe("groq");
  });

  it("returns no_key when no providers are configured", async () => {
    const result = await chatWithShannonBotProviders(
      { messages: [{ role: "user", content: "hello" }] },
      readShannonBotEnvKeys({}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_key");
    }
  });

  it("parses a successful Groq-compatible response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: "What evidence supports that residue?" } }],
      }),
    );
    const provider = createGroqProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await provider.chat({
      messages: [
        { role: "system", content: "Be Socratic." },
        { role: "user", content: "Is residue 57 important?" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("groq");
      expect(result.content).toContain("evidence");
    }
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toContain("Bearer test-key");
  });

  it("maps HTTP 429 to rate_limit and does not invent content", async () => {
    const fetchImpl = vi.fn(async () => new Response("slow down", { status: 429 }));
    const provider = createOpenRouterProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await provider.chat({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("rate_limit");
      expect(result.message.toLowerCase()).toMatch(/local socratic/i);
    }
  });

  it("falls back across providers when the first fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: "Which module result are you citing?" } }],
        }),
      );
    const keys = readShannonBotEnvKeys({
      GROQ_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    });
    const providers = resolveShannonBotProviders(keys, fetchImpl as typeof fetch);
    expect(providers.map((p) => p.id)).toEqual(["groq", "openrouter"]);
    const result = await chatWithShannonBotProviders(
      { messages: [{ role: "user", content: "help" }] },
      keys,
      fetchImpl as typeof fetch,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("openrouter");
      expect(result.content).toContain("module result");
    }
  });

  it("maps timeout errors without inventing a reply", async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    });
    const provider = createGroqProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await provider.chat({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("timeout");
    }
  });
});
