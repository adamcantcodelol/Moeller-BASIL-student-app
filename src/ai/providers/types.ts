/**
 * Optional free-tier LLM chat providers for ShannonBot.
 * Keys stay server-side only. Failures must fall back to local Socratic mode.
 */

export type ShannonBotLlmProviderId = "groq" | "openrouter";

export interface LlmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatRequest {
  messages: LlmChatMessage[];
  /** Override default model for the selected provider. */
  model?: string;
  /** Request timeout in ms (default 12s). */
  timeoutMs?: number;
}

export interface LlmChatSuccess {
  ok: true;
  content: string;
  provider: ShannonBotLlmProviderId;
  model: string;
}

export interface LlmChatFailure {
  ok: false;
  provider: ShannonBotLlmProviderId | null;
  reason: "no_key" | "timeout" | "rate_limit" | "http_error" | "invalid_response" | "network";
  message: string;
}

export type LlmChatResult = LlmChatSuccess | LlmChatFailure;

export interface LlmProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface LlmProvider {
  id: ShannonBotLlmProviderId;
  defaultModel: string;
  chat(request: LlmChatRequest): Promise<LlmChatResult>;
}

export const DEFAULT_LLM_TIMEOUT_MS = 12_000;
