import { generateText } from "ai";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { getLanguageModelForLexTask, getProviderOptionsForLexTask } from "@/lib/ai/llm";
import { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";
import {
  deepseekStructureResponseSchema,
  stripMarkdownJson,
  type DeepseekStructureResponse,
} from "./structured-output-schema";

const SYSTEM = `Você é assistente jurídico do Lex (Brasil). Organize a entrada em JSON.
REGRAS OBRIGATÓRIAS:
1) NÃO invente CPF, CNPJ, número de processo, documento, nome de pessoa ou fato que não esteja no texto de entrada.
2) Se algo não constar, omita ou use null — prefira listar em missing_questions ou missing_documents.
3) Cada item em parties, facts, requests e risks deve ter confidence entre 0 e 1 coerente com a evidência no texto.
4) parties.role: AUTHOR = cliente/parte assistida; DEFENDANT = parte contrária; INTERVENING = terceiros relevantes.
5) Não contradiga campos marcados na seção "CAMPOS CONFIRMADOS PELO ADVOGADO".
6) Use português do Brasil. Datas em texto livre podem ser repetidas em facts.dates quando claras.
7) Responda APENAS com um único objeto JSON válido, sem markdown, sem comentários.`;

export async function runDeepseekFundamentalStructure(
  narrative: string,
  telemetry?: { workspaceId?: string; caseId?: string },
): Promise<DeepseekStructureResponse> {
  let text: string;
  try {
    const result = await generateText({
      model: getLanguageModelForLexTask("intake_structuring"),
      providerOptions: getProviderOptionsForLexTask("intake_structuring"),
      system: SYSTEM,
      prompt:
        "Entrada da entrevista fundamental:\n\n" +
        narrative.slice(0, 48_000) +
        "\n\nDevolva o JSON com as chaves: parties, facts, requests, risks, timeline, missing_documents, missing_questions, next_steps, case_summary, legal_area_suggestion, urgency_score, readiness_score.",
      temperature: 0.1,
      maxOutputTokens: 4500,
      experimental_telemetry: aiTelemetry({
        functionId: "intake-structuring",
        metadata: {
          workspaceId: telemetry?.workspaceId ?? "",
          caseId: telemetry?.caseId ?? "",
          narrativeLen: narrative.length,
        },
      }),
    });
    text = result.text;
  } catch (e) {
    const normalized = normalizeAiProviderError(e);
    throw new Error(normalized.userMessage, { cause: e });
  }

  const cleaned = stripMarkdownJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error(
      normalizeAiProviderError(new Error("Modelo não retornou JSON válido.")).userMessage,
    );
  }
  const parsed = deepseekStructureResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      normalizeAiProviderError(new Error(`JSON estrutural inválido: ${parsed.error.message}`))
        .userMessage,
    );
  }
  return parsed.data;
}
