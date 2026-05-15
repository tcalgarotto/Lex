import { describe, it, expect } from "vitest";
import { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";

describe("normalizeAiProviderError", () => {
  it("maps UnsupportedModelVersionError to friendly message", () => {
    const err = new Error(
      'Unsupported model version v1 for provider "deepseek.chat" and model "deepseek-chat".',
    );
    err.name = "UnsupportedModelVersionError";
    const out = normalizeAiProviderError(err);
    expect(out.code).toBe("unsupported_model");
    expect(out.userMessage).not.toContain("v1");
    expect(out.userMessage).not.toContain("AI SDK");
  });

  it("maps missing API key", () => {
    const out = normalizeAiProviderError(
      new Error("DEEPSEEK_API_KEY obrigatório para usar o provedor DeepSeek."),
    );
    expect(out.code).toBe("missing_api_key");
    expect(out.userMessage).toContain("configurada");
  });

  it("maps invalid JSON without leaking schema details to user", () => {
    const out = normalizeAiProviderError(new Error("Modelo não retornou JSON válido."));
    expect(out.code).toBe("invalid_json");
    expect(out.userMessage).toContain("rascunho");
  });

  it("does not echo API keys in user message", () => {
    const out = normalizeAiProviderError(new Error("Invalid api key sk-secret-123"));
    expect(out.userMessage).not.toContain("sk-secret");
  });
});
