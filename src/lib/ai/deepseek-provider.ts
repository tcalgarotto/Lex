/** Uso exclusivo server-side (API routes / server actions). Não importar em Client Components. */
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import {
  isDeepSeekThinkingEnabledForPro,
  readDeepSeekApiKey,
  readDeepSeekBaseUrl,
  readDeepSeekReasoningEffortDefault,
} from "@/lib/ai/deepseek-config";
import {
  isProLexAiTask,
  resolveDeepSeekModelIdForTask,
  type LexAiTask,
} from "@/lib/ai/deepseek-model-router";

let cachedProvider: ReturnType<typeof createDeepSeek> | null = null;

function getDeepSeekProvider(): ReturnType<typeof createDeepSeek> {
  const apiKey = readDeepSeekApiKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY obrigatório para usar o provedor DeepSeek.");
  }
  if (!cachedProvider) {
    cachedProvider = createDeepSeek({
      apiKey,
      baseURL: readDeepSeekBaseUrl(),
    });
  }
  return cachedProvider;
}

/**
 * Modelo DeepSeek compatível com AI SDK 6 (spec v2+ via @ai-sdk/deepseek).
 * Não usar createOpenAI({ name: "deepseek" }) — isso gera LanguageModelV1.
 */
export function getDeepSeekLanguageModelForTask(task: LexAiTask): LanguageModel {
  const provider = getDeepSeekProvider();
  const modelId = resolveDeepSeekModelIdForTask(task);
  return provider.languageModel(modelId) as unknown as LanguageModel;
}

/** Opções do provider DeepSeek (thinking / reasoning) para passar em generateText/streamText. */
export function getDeepSeekProviderOptionsForTask(task: LexAiTask) {
  const usePro = isProLexAiTask(task);
  const thinking =
    usePro && isDeepSeekThinkingEnabledForPro() ? ("enabled" as const) : ("disabled" as const);

  const deepseek: {
    thinking: { type: "enabled" | "disabled" };
    reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max";
  } = {
    thinking: { type: thinking },
  };

  if (usePro) {
    const effort = readDeepSeekReasoningEffortDefault();
    if (effort) deepseek.reasoningEffort = effort;
  }

  return { deepseek };
}

export function getDeepSeekModelIdForTask(task: LexAiTask): string {
  return resolveDeepSeekModelIdForTask(task);
}

export function assertDeepSeekConfigured(): void {
  if (!readDeepSeekApiKey()) {
    throw new Error("DEEPSEEK_API_KEY obrigatório para usar o provedor DeepSeek.");
  }
}
