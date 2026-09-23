import { createGroqProvider } from "@/ai/providers/groq";
import { createOpenRouterProvider } from "@/ai/providers/openrouter";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  ShannonBotLlmProviderId,
} from "@/ai/providers/types";

export interface ShannonBotEnvKeys {
  groqApiKey: string | null;
  openRouterApiKey: string | null;
  /** Alias treated as a Groq key when GROQ_API_KEY is unset. */
  shannonBotApiKey: string | null;
  preferredProvider: ShannonBotLlmProviderId | null;
  groqModel: string | null;
  openRouterModel: string | null;
}

function nonempty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function readShannonBotEnvKeys(
  env: Record<string, string | undefined> = process.env,
): ShannonBotEnvKeys {
  const preferred = env.SHANNONBOT_PROVIDER?.trim().toLowerCase();
  return {
    groqApiKey: nonempty(env.GROQ_API_KEY),
    openRouterApiKey: nonempty(env.OPENROUTER_API_KEY),
    shannonBotApiKey: nonempty(env.SHANNONBOT_API_KEY),
    preferredProvider:
      preferred === "groq" || preferred === "openrouter" ? preferred : null,
    groqModel: nonempty(env.GROQ_MODEL) ?? nonempty(env.SHANNONBOT_MODEL),
    openRouterModel:
      nonempty(env.OPENROUTER_MODEL) ?? nonempty(env.SHANNONBOT_MODEL),
  };
}

export function describeMissingAiKeys(): string {
  return "No free-tier AI API key configured (set GROQ_API_KEY or OPENROUTER_API_KEY server-side). ShannonBot is running in local Socratic mode and will not invent scientific results.";
}

export function hasShannonBotApiKey(keys: ShannonBotEnvKeys = readShannonBotEnvKeys()): boolean {
  return Boolean(keys.groqApiKey || keys.openRouterApiKey || keys.shannonBotApiKey);
}

/**
 * Ordered providers from env. Prefer SHANNONBOT_PROVIDER, else Groq, else OpenRouter.
 * SHANNONBOT_API_KEY is treated as a Groq key alias.
 */
export function resolveShannonBotProviders(
  keys: ShannonBotEnvKeys = readShannonBotEnvKeys(),
  fetchImpl?: typeof fetch,
): LlmProvider[] {
  const groqKey = keys.groqApiKey ?? keys.shannonBotApiKey;
  const groq =
    groqKey !== null
      ? createGroqProvider({
          apiKey: groqKey,
          model: keys.groqModel ?? undefined,
          fetchImpl,
        })
      : null;
  const openrouter =
    keys.openRouterApiKey !== null
      ? createOpenRouterProvider({
          apiKey: keys.openRouterApiKey,
          model: keys.openRouterModel ?? undefined,
          fetchImpl,
        })
      : null;

  const providers: LlmProvider[] = [];
  if (keys.preferredProvider === "openrouter" && openrouter) {
    providers.push(openrouter);
    if (groq) providers.push(groq);
  } else if (keys.preferredProvider === "groq" && groq) {
    providers.push(groq);
    if (openrouter) providers.push(openrouter);
  } else {
    if (groq) providers.push(groq);
    if (openrouter) providers.push(openrouter);
  }
  return providers;
}

/**
 * Try each configured provider. On total failure return a failure result so the
 * caller can use local Socratic mode — never fabricate scientific content.
 */
export async function chatWithShannonBotProviders(
  request: LlmChatRequest,
  keys: ShannonBotEnvKeys = readShannonBotEnvKeys(),
  fetchImpl?: typeof fetch,
): Promise<LlmChatResult> {
  const providers = resolveShannonBotProviders(keys, fetchImpl);
  if (providers.length === 0) {
    return {
      ok: false,
      provider: null,
      reason: "no_key",
      message: describeMissingAiKeys(),
    };
  }

  let lastFailure: LlmChatResult | null = null;
  for (const provider of providers) {
    const result = await provider.chat(request);
    if (result.ok) {
      return result;
    }
    lastFailure = result;
  }

  return (
    lastFailure ?? {
      ok: false,
      provider: null,
      reason: "http_error",
      message:
        "All configured LLM providers failed. Falling back to local Socratic mode.",
    }
  );
}
