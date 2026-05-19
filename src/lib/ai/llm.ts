import { generateText } from "ai";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { getDeepSeekProviderOptionsForTask } from "@/lib/ai/deepseek-provider";
import { getChatProviderId, getLanguageModelForLexTask } from "@/lib/ai/providers/factory";

export {
  getChatLanguageModel,
  getPieceLanguageModel,
  getChatModelId,
  getPieceModelId,
  getChatProviderId,
  getLanguageModelForLexTask,
} from "@/lib/ai/providers/factory";
export type { LexAiTask } from "@/lib/ai/deepseek-model-router";
export { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";
export {
  getDeepSeekProviderOptionsForTask,
  getDeepSeekModelIdForTask,
} from "@/lib/ai/deepseek-provider";

/** providerOptions DeepSeek apenas quando o provedor ativo é deepseek. */
export function getProviderOptionsForLexTask(task: Parameters<typeof getDeepSeekProviderOptionsForTask>[0]) {
  if (getChatProviderId() !== "deepseek") return undefined;
  return getDeepSeekProviderOptionsForTask(task);
}

export async function expandQuery(userQuery: string): Promise<string> {
  const { text } = await generateText({
    model: getLanguageModelForLexTask("summary"),
    providerOptions: getProviderOptionsForLexTask("summary"),
    maxOutputTokens: 120,
    temperature: 0.2,
    prompt: `Reescreva a pergunta abaixo em 1-2 frases curtas otimizadas para busca jurídica brasileira (termos processuais, legislação). Não invente fatos.\n\nPergunta: ${userQuery}`,
    experimental_telemetry: aiTelemetry({
      functionId: "query-expand",
      metadata: { queryLen: userQuery.length },
    }),
  });
  return text.trim() || userQuery;
}
