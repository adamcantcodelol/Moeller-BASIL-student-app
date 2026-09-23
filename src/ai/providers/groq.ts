import { postOpenAiCompatibleChat } from "@/ai/providers/openaiCompatible";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  LlmProviderOptions,
} from "@/ai/providers/types";

export const GROQ_CHAT_URL =
  "https://api.groq.com/openai/v1/chat/completions";

/** Fast free-tier friendly default on Groq. */
export const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";

export function createGroqProvider(options: LlmProviderOptions): LlmProvider {
  const model = options.model?.trim() || GROQ_DEFAULT_MODEL;
  return {
    id: "groq",
    defaultModel: model,
    async chat(request: LlmChatRequest): Promise<LlmChatResult> {
      return postOpenAiCompatibleChat({
        provider: "groq",
        url: GROQ_CHAT_URL,
        apiKey: options.apiKey,
        model,
        request,
        fetchImpl: options.fetchImpl,
      });
    },
  };
}
