export type NormalizedAiErrorCode =
  | "missing_api_key"
  | "unsupported_model"
  | "rate_limit"
  | "invalid_json"
  | "timeout"
  | "provider_unavailable"
  | "unknown";

export type NormalizedAiError = {
  code: NormalizedAiErrorCode;
  userMessage: string;
  technicalHint?: string;
};

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function nameFromUnknown(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  return undefined;
}

/**
 * Converte erros do AI SDK / DeepSeek em mensagens seguras para o usuário final.
 * Não inclui prompt, PII nem API key.
 */
export function normalizeAiProviderError(error: unknown): NormalizedAiError {
  const msg = messageFromUnknown(error);
  const name = nameFromUnknown(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes("deepseek_api_key") ||
    lower.includes("api key") && lower.includes("obrigat") ||
    lower.includes("not configured") && lower.includes("deepseek")
  ) {
    return {
      code: "missing_api_key",
      userMessage: "A IA ainda não está configurada neste ambiente.",
    };
  }

  if (
    name === "UnsupportedModelVersionError" ||
    lower.includes("unsupported model version") ||
    lower.includes("specification version") ||
    (lower.includes("deepseek.chat") && lower.includes("v1"))
  ) {
    return {
      code: "unsupported_model",
      userMessage:
        "A IA não está disponível neste momento. A configuração do provedor precisa ser revisada.",
      technicalHint: "model_spec_mismatch",
    };
  }

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return {
      code: "rate_limit",
      userMessage: "A IA está temporariamente sobrecarregada. Tente novamente em instantes.",
    };
  }

  if (
    lower.includes("json") &&
    (lower.includes("inválido") ||
      lower.includes("invalid") ||
      lower.includes("parse") ||
      lower.includes("não retornou") ||
      lower.includes("estrutural inválido"))
  ) {
    return {
      code: "invalid_json",
      userMessage:
        "A IA não conseguiu estruturar a resposta. O rascunho foi preservado — revise os dados e tente de novo.",
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    return {
      code: "timeout",
      userMessage: "A IA demorou demais para responder. Tente novamente.",
    };
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return {
      code: "provider_unavailable",
      userMessage: "A IA não está disponível neste momento. Tente novamente mais tarde.",
    };
  }

  return {
    code: "unknown",
    userMessage: "A IA não está disponível neste momento. Tente novamente ou salve apenas o rascunho.",
    technicalHint: name ?? "unknown_error",
  };
}
