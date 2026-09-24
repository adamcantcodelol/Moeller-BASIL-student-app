import {
  DEFAULT_LLM_TIMEOUT_MS,
  type LlmChatRequest,
  type LlmChatResult,
  type ShannonBotLlmProviderId,
} from "@/ai/providers/types";

/**
 * Shared OpenAI-compatible chat completions POST (Groq + OpenRouter).
 * Never invents a reply body on failure — callers fall back to local Socratic mode.
 */
export async function postOpenAiCompatibleChat(options: {
  provider: ShannonBotLlmProviderId;
  url: string;
  apiKey: string;
  model: string;
  request: LlmChatRequest;
  fetchImpl?: typeof fetch;
  extraHeaders?: Record<string, string>;
}): Promise<LlmChatResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.request.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const model = options.request.model ?? options.model;

  let response: Response;
  try {
    response = await fetchImpl(options.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: options.request.messages,
        temperature: 0.3,
        max_tokens: options.request.maxTokens ?? 700,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return {
        ok: false,
        provider: options.provider,
        reason: "timeout",
        message: `${options.provider} timed out after ${timeoutMs}ms. Falling back to local Socratic mode.`,
      };
    }
    return {
      ok: false,
      provider: options.provider,
      reason: "network",
      message: `Could not reach ${options.provider}. Falling back to local Socratic mode.`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      provider: options.provider,
      reason: "rate_limit",
      message: `${options.provider} rate-limited the request. Falling back to local Socratic mode.`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      provider: options.provider,
      reason: "http_error",
      message: `${options.provider} returned HTTP ${response.status}. Falling back to local Socratic mode.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      provider: options.provider,
      reason: "invalid_response",
      message: `${options.provider} returned non-JSON. Falling back to local Socratic mode.`,
    };
  }

  const content = extractAssistantContent(body);
  if (!content) {
    return {
      ok: false,
      provider: options.provider,
      reason: "invalid_response",
      message: `${options.provider} returned an empty assistant message. Falling back to local Socratic mode.`,
    };
  }

  return {
    ok: true,
    content,
    provider: options.provider,
    model,
  };
}

function extractAssistantContent(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (first === null || typeof first !== "object") {
    return null;
  }
  const message = (first as { message?: unknown }).message;
  if (message === null || typeof message !== "object") {
    return null;
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    return null;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
}
