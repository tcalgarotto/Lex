import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getEnv } from "@/lib/env";
import {
  getDeepSeekLanguageModelForTask,
  getDeepSeekModelIdForTask,
} from "@/lib/ai/deepseek-provider";
import type { LexAiTask } from "@/lib/ai/deepseek-model-router";
import { readDeepSeekModelFast } from "@/lib/ai/deepseek-config";

export type AiChatProviderId = "deepseek" | "openai" | "anthropic" | "openrouter";

export function getChatProviderId(): AiChatProviderId {
  return getEnv().AI_CHAT_PROVIDER;
}

export function getChatModelId(): string {
  const env = getEnv();
  if (env.AI_MODEL_CHAT) return env.AI_MODEL_CHAT;
  switch (env.AI_CHAT_PROVIDER) {
    case "deepseek":
      return getDeepSeekModelIdForTask("chat");
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "openrouter":
      return "openai/gpt-4o-mini";
    default:
      return readDeepSeekModelFast();
  }
}

export function getPieceModelId(): string {
  const env = getEnv();
  if (env.AI_MODEL_COMPLETION) return env.AI_MODEL_COMPLETION;
  if (env.AI_CHAT_PROVIDER === "deepseek") {
    return getDeepSeekModelIdForTask("draft_generation");
  }
  return getChatModelId();
}

export function getLanguageModelForLexTask(task: LexAiTask): LanguageModel {
  const env = getEnv();
  if (env.AI_CHAT_PROVIDER === "deepseek") {
    return getDeepSeekLanguageModelForTask(task);
  }
  return task === "draft_generation" || task === "draft_review" || task === "strategy"
    ? getPieceLanguageModel()
    : getChatLanguageModel();
}

/** Modelo de chat/streaming unificado — nunca acoplar a um único vendor. */
export function getChatLanguageModel(): LanguageModel {
  const env = getEnv();
  if (env.AI_CHAT_PROVIDER === "deepseek") {
    return getDeepSeekLanguageModelForTask("chat");
  }

  const modelId = getChatModelId();
  switch (env.AI_CHAT_PROVIDER) {
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY! })(modelId) as unknown as LanguageModel;
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY! })(modelId) as unknown as LanguageModel;
    case "openrouter":
      return createOpenAI({
        name: "openrouter",
        apiKey: env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
          "X-Title": "Lex",
        },
      })(modelId) as unknown as LanguageModel;
    default:
      return getDeepSeekLanguageModelForTask("chat");
  }
}

export function getPieceLanguageModel(): LanguageModel {
  const env = getEnv();
  if (env.AI_CHAT_PROVIDER === "deepseek") {
    return getDeepSeekLanguageModelForTask("draft_generation");
  }

  const modelId = getPieceModelId();
  switch (env.AI_CHAT_PROVIDER) {
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY! })(modelId) as unknown as LanguageModel;
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY! })(modelId) as unknown as LanguageModel;
    case "openrouter":
      return createOpenAI({
        name: "openrouter",
        apiKey: env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
          "X-Title": "Lex",
        },
      })(modelId) as unknown as LanguageModel;
    default:
      return getDeepSeekLanguageModelForTask("draft_generation");
  }
}
