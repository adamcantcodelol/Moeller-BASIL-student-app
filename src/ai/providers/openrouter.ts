import { postOpenAiCompatibleChat } from "@/ai/providers/openaiCompatible";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  LlmProviderOptions,
} from "@/ai/providers/types";

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/** Free-tier OpenRouter model id (verify at deploy time if renamed upstream). */
export const OPENROUTER_DEFAULT_MODEL =
  "meta-llama/llama-3.1-8b-instruct:free";

export function createOpenRouterProvider(
  options: LlmProviderOptions,
): LlmProvider {
  const model = options.model?.trim() || OPENROUTER_DEFAULT_MODEL;
  return {
    id: "openrouter",
    defaultModel: model,
    async chat(request: LlmChatRequest): Promise<LlmChatResult> {
      return postOpenAiCompatibleChat({
        provider: "openrouter",
        url: OPENROUTER_CHAT_URL,
        apiKey: options.apiKey,
        model,
        request,
        fetchImpl: options.fetchImpl,
        extraHeaders: {
          // OpenRouter asks for these; safe public identifiers, not secrets.
          "HTTP-Referer": "https://github.com/adamcantcodelol/Moeller-BASIL-student-app",
          "X-Title": "Moeller BASIL ShannonBot",
        },
      });
    },
  };
}
