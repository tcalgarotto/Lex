/** Modelos DeepSeek V4 recomendados (evitar deepseek-chat/reasoner como default). */
export const DEEPSEEK_MODEL_FAST_DEFAULT = "deepseek-v4-flash";
export const DEEPSEEK_MODEL_PRO_DEFAULT = "deepseek-v4-pro";

export function readDeepSeekApiKey(): string | undefined {
  return process.env["DEEPSEEK_API_KEY"]?.trim() || undefined;
}

export function readDeepSeekBaseUrl(): string {
  return (process.env["DEEPSEEK_BASE_URL"]?.trim() || "https://api.deepseek.com").replace(/\/$/, "");
}

export function readDeepSeekModelFast(): string {
  return process.env["DEEPSEEK_MODEL_FAST"]?.trim() || DEEPSEEK_MODEL_FAST_DEFAULT;
}

export function readDeepSeekModelPro(): string {
  return process.env["DEEPSEEK_MODEL_PRO"]?.trim() || DEEPSEEK_MODEL_PRO_DEFAULT;
}

export function readDeepSeekModelDefault(): string {
  return process.env["DEEPSEEK_MODEL_DEFAULT"]?.trim() || readDeepSeekModelFast();
}

export function isDeepSeekThinkingEnabledForPro(): boolean {
  const v = process.env["DEEPSEEK_ENABLE_THINKING_FOR_PRO"]?.trim().toLowerCase();
  if (!v) return true;
  return v !== "0" && v !== "false" && v !== "no";
}

export function readDeepSeekReasoningEffortDefault():
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | undefined {
  const raw = process.env["DEEPSEEK_REASONING_EFFORT_DEFAULT"]?.trim().toLowerCase();
  if (!raw) return "high";
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max") {
    return raw;
  }
  return undefined;
}
