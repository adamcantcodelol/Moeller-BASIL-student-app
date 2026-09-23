export {
  chatWithShannonBotProviders,
  describeMissingAiKeys,
  hasShannonBotApiKey,
  readShannonBotEnvKeys,
  resolveShannonBotProviders,
  type ShannonBotEnvKeys,
} from "@/ai/providers/resolve";
export { createGroqProvider, GROQ_DEFAULT_MODEL, GROQ_CHAT_URL } from "@/ai/providers/groq";
export {
  createOpenRouterProvider,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_CHAT_URL,
} from "@/ai/providers/openrouter";
export type {
  LlmChatFailure,
  LlmChatMessage,
  LlmChatRequest,
  LlmChatResult,
  LlmChatSuccess,
  LlmProvider,
  ShannonBotLlmProviderId,
} from "@/ai/providers/types";
