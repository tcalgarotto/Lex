import {
  readDeepSeekModelDefault,
  readDeepSeekModelFast,
  readDeepSeekModelPro,
} from "@/lib/ai/deepseek-config";

export type LexAiTask =
  | "intake_structuring"
  | "classification"
  | "summary"
  | "case_brain"
  | "legal_research_suggestions"
  | "strategy"
  | "draft_generation"
  | "draft_review"
  | "chat"
  | "fallback";

const PRO_TASKS = new Set<LexAiTask>([
  "strategy",
  "draft_generation",
  "draft_review",
]);

const FAST_TASKS = new Set<LexAiTask>([
  "intake_structuring",
  "classification",
  "summary",
  "case_brain",
  "legal_research_suggestions",
  "chat",
  "fallback",
]);

/** Resolve o model id DeepSeek para a tarefa (sem instanciar o provider). */
export function resolveDeepSeekModelIdForTask(task: LexAiTask): string {
  if (PRO_TASKS.has(task)) return readDeepSeekModelPro();
  if (FAST_TASKS.has(task)) return readDeepSeekModelFast();
  return readDeepSeekModelDefault();
}

export function isProLexAiTask(task: LexAiTask): boolean {
  return PRO_TASKS.has(task);
}
