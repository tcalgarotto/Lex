import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveDeepSeekModelIdForTask,
  isProLexAiTask,
} from "@/lib/ai/deepseek-model-router";

describe("deepseek model router", () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["DEEPSEEK_MODEL_FAST", "DEEPSEEK_MODEL_PRO", "DEEPSEEK_MODEL_DEFAULT"]) {
      envBackup[key] = process.env[key];
    }
    delete process.env["DEEPSEEK_MODEL_FAST"];
    delete process.env["DEEPSEEK_MODEL_PRO"];
    delete process.env["DEEPSEEK_MODEL_DEFAULT"];
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(envBackup)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("uses deepseek-v4-flash for intake_structuring", () => {
    expect(resolveDeepSeekModelIdForTask("intake_structuring")).toBe("deepseek-v4-flash");
    expect(isProLexAiTask("intake_structuring")).toBe(false);
  });

  it("uses deepseek-v4-flash for classification and summary", () => {
    expect(resolveDeepSeekModelIdForTask("classification")).toBe("deepseek-v4-flash");
    expect(resolveDeepSeekModelIdForTask("summary")).toBe("deepseek-v4-flash");
  });

  it("uses deepseek-v4-pro for strategy, draft and review", () => {
    expect(resolveDeepSeekModelIdForTask("strategy")).toBe("deepseek-v4-pro");
    expect(resolveDeepSeekModelIdForTask("draft_generation")).toBe("deepseek-v4-pro");
    expect(resolveDeepSeekModelIdForTask("draft_review")).toBe("deepseek-v4-pro");
    expect(isProLexAiTask("strategy")).toBe(true);
  });

  it("respects env overrides", () => {
    process.env["DEEPSEEK_MODEL_FAST"] = "custom-flash";
    process.env["DEEPSEEK_MODEL_PRO"] = "custom-pro";
    expect(resolveDeepSeekModelIdForTask("chat")).toBe("custom-flash");
    expect(resolveDeepSeekModelIdForTask("draft_generation")).toBe("custom-pro");
  });

  it("does not default to deepseek-chat", () => {
    expect(resolveDeepSeekModelIdForTask("fallback")).not.toBe("deepseek-chat");
    expect(resolveDeepSeekModelIdForTask("intake_structuring")).not.toBe("deepseek-reasoner");
  });
});
