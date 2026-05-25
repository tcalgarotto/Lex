/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import type { LegalResearchProvider, LegalResearchRequest, LegalResearchResponse } from "./types";
import {
  buildLegalResearchSystemPrompt,
  buildLegalResearchUserPrompt,
  buildRecommendForCaseUserPrompt,
  promptVersion,
} from "./legal-research-prompts";
import { normalizeDeepSeekJsonContent } from "./normalize-deepseek-result";
import { applyLegalResearchSafety } from "./legal-research-safety";

function timeoutMs(): number {
  const raw = process.env["DEEPSEEK_LEGAL_RESEARCH_TIMEOUT_MS"];
  const n = raw ? parseInt(raw, 10) : 15_000;
  return Number.isFinite(n) && n > 0 ? n : 15_000;
}

function deepSeekBaseUrl(): string {
  return (
    process.env["DEEPSEEK_BASE_URL"]?.trim() || "https://api.deepseek.com"
  ).replace(/\/$/, "");
}

function modelId(): string {
  const legacy = process.env["DEEPSEEK_MODEL"]?.trim();
  if (legacy) return legacy;
  const fast = process.env["DEEPSEEK_MODEL_FAST"]?.trim();
  if (fast) return fast;
  return "deepseek-v4-flash";
}

function enabled(): boolean {
  const v = process.env["DEEPSEEK_LEGAL_RESEARCH_ENABLED"]?.trim().toLowerCase();
  if (!v) return true;
  return v !== "0" && v !== "false" && v !== "no";
}

const disabledResponse = (meta: Record<string, unknown>): LegalResearchResponse => ({
  summary:
    "O modo de pesquisa jurídica assistida está desligado por configuração do ambiente.",
  suggestedSearches: [],
  legalFoundations: [],
  jurisprudenceCandidates: [],
  strategyNotes: [],
  draftingSuggestions: [],
  riskFlags: ["Assistência JustOS AI desativada (configuração do ambiente)."],
  missingInformation: [],
  providerMetadata: { ...meta, promptVersion, disabled: true },
});

interface ChatCompletionMessage {
  content?: string | null;
}

interface ChatCompletionChoice {
  message?: ChatCompletionMessage;
}

interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface DeepSeekCompletionResponse {
  choices?: ChatCompletionChoice[];
  usage?: DeepSeekUsage;
  error?: { message?: string };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function upstreamErrorResponse(
  message: string,
  latencyMs: number,
): LegalResearchResponse {
  return applyLegalResearchSafety({
    summary: `Falha temporária na pesquisa assistida: ${message}`,
    suggestedSearches: [],
    legalFoundations: [],
    jurisprudenceCandidates: [],
    strategyNotes: [],
    draftingSuggestions: [],
    riskFlags: ["Não foi possível concluir a chamada ao provedor externo."],
    missingInformation: ["Tente novamente em instantes ou reduza o escopo da pergunta."],
    providerMetadata: {
      provider: "deepseek",
      model: process.env["DEEPSEEK_MODEL"] ?? "",
      promptVersion,
      latencyMs,
      upstreamError: message,
      timestamp: new Date().toISOString(),
    },
  });
}

async function callDeepSeekChat(params: {
  system: string;
  user: string;
}): Promise<{ text: string; usage: DeepSeekUsage | undefined; model: string }> {
  const apiKey = process.env["DEEPSEEK_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY não configurado.");
  }

  const model = modelId();
  const url = `${deepSeekBaseUrl()}/v1/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const attempt = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  };

  let res: Response;
  try {
    res = await attempt();
    if (res.status >= 500 || res.status === 429) {
      await sleep(1000);
      res = await attempt();
    }
  } catch {
    await sleep(1000);
    res = await attempt();
  }

  const json = (await res.json()) as DeepSeekCompletionResponse;
  if (!res.ok) {
    const msg = json.error?.message || res.statusText || "Erro HTTP";
    throw new Error(msg);
  }

  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, usage: json.usage, model };
}

function runPipeline(
  rawText: string,
  usage: DeepSeekUsage | undefined,
  model: string,
  latencyMs: number,
): LegalResearchResponse {
  const baseMeta: Record<string, unknown> = {
    provider: "deepseek",
    model,
    promptVersion,
    latencyMs,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
  };
  const normalized = normalizeDeepSeekJsonContent(rawText, baseMeta);
  return applyLegalResearchSafety({
    ...normalized,
    providerMetadata: {
      ...normalized.providerMetadata,
      ...baseMeta,
      timestamp: new Date().toISOString(),
    },
  });
}

export class DeepSeekLegalResearchProvider implements LegalResearchProvider {
  async search(req: LegalResearchRequest): Promise<LegalResearchResponse> {
    if (!enabled()) {
      return disabledResponse({ provider: "deepseek", reason: "flag_disabled" });
    }
    const t0 = Date.now();
    try {
      const { text, usage, model } = await callDeepSeekChat({
        system: buildLegalResearchSystemPrompt(),
        user: buildLegalResearchUserPrompt(req),
      });
      return runPipeline(text, usage, model, Date.now() - t0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return upstreamErrorResponse(msg, Date.now() - t0);
    }
  }

  async recommendForCase(req: LegalResearchRequest): Promise<LegalResearchResponse> {
    if (!enabled()) {
      return disabledResponse({ provider: "deepseek", reason: "flag_disabled" });
    }
    const t0 = Date.now();
    try {
      const { text, usage, model } = await callDeepSeekChat({
        system: buildLegalResearchSystemPrompt(),
        user: buildRecommendForCaseUserPrompt(req),
      });
      return runPipeline(text, usage, model, Date.now() - t0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return upstreamErrorResponse(msg, Date.now() - t0);
    }
  }
}
