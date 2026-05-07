import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "@ai-sdk/provider";
import { getEnv } from "@/lib/env";

export type AiChatProviderId = "deepseek" | "openai" | "anthropic" | "openrouter";

export function getChatProviderId(): AiChatProviderId {
  return getEnv().AI_CHAT_PROVIDER;
}

export function getChatModelId(): string {
  const env = getEnv();
  if (env.AI_MODEL_CHAT) return env.AI_MODEL_CHAT;
  switch (env.AI_CHAT_PROVIDER) {
    case "deepseek":
      return "deepseek-chat";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "openrouter":
      return "openai/gpt-4o-mini";
    default:
      return "deepseek-chat";
  }
}

export function getPieceModelId(): string {
  const env = getEnv();
  return env.AI_MODEL_COMPLETION ?? getChatModelId();
}

/** Modelo de chat/streaming unificado — nunca acoplar a um único vendor. */
export function getChatLanguageModel(): LanguageModelV1 {
  const env = getEnv();
  const modelId = getChatModelId();

  switch (env.AI_CHAT_PROVIDER) {
    case "deepseek":
      return createOpenAI({
        name: "deepseek",
        apiKey: env.DEEPSEEK_API_KEY!,
        baseURL: env.DEEPSEEK_BASE_URL,
      })(modelId);
    case "openai":
      return createOpenAI({
        apiKey: env.OPENAI_API_KEY!,
      })(modelId);
    case "anthropic":
      return createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY!,
      })(modelId);
    case "openrouter":
      return createOpenAI({
        name: "openrouter",
        apiKey: env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
          "X-Title": "Lex",
        },
      })(modelId);
    default:
      return createOpenAI({
        name: "deepseek",
        apiKey: env.DEEPSEEK_API_KEY!,
        baseURL: env.DEEPSEEK_BASE_URL,
      })(modelId);
  }
}

export function getPieceLanguageModel(): LanguageModelV1 {
  const env = getEnv();
  const modelId = getPieceModelId();

  switch (env.AI_CHAT_PROVIDER) {
    case "deepseek":
      return createOpenAI({
        name: "deepseek",
        apiKey: env.DEEPSEEK_API_KEY!,
        baseURL: env.DEEPSEEK_BASE_URL,
      })(modelId);
    case "openai":
      return createOpenAI({
        apiKey: env.OPENAI_API_KEY!,
      })(modelId);
    case "anthropic":
      return createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY!,
      })(modelId);
    case "openrouter":
      return createOpenAI({
        name: "openrouter",
        apiKey: env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
          "X-Title": "Lex",
        },
      })(modelId);
    default:
      return createOpenAI({
        name: "deepseek",
        apiKey: env.DEEPSEEK_API_KEY!,
        baseURL: env.DEEPSEEK_BASE_URL,
      })(modelId);
  }
}
