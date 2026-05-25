import { generateText } from "ai";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { getLanguageModelForLexTask, getProviderOptionsForLexTask } from "@/lib/ai/llm";
import { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";
import {
  deepseekStructureResponseSchema,
  stripMarkdownJson,
  type DeepseekStructureResponse,
} from "./structured-output-schema";

const SYSTEM = `Você é assistente jurídico do JustOS (Brasil). ESTRUTURE o relato — não copie parágrafos inteiros.
REGRAS OBRIGATÓRIAS:
1) NÃO invente CPF, CNPJ, número de processo, documento, nome de pessoa ou fato que não esteja no texto de entrada.
2) Se algo não constar, omita ou use null — registre lacunas em missing_questions, information_gaps ou missing_documents.
3) case_summary: síntese jurídica objetiva (máx. ~600 caracteres), NUNCA colagem do relato bruto.
4) facts: eventos em ordem cronológica quando possível; cada fato em frase própria, com dates quando houver.
5) parties.role: AUTHOR = cliente/parte assistida; DEFENDANT = parte contrária; INTERVENING = terceiros.
6) party_relations: vínculos explícitos entre partes (ex.: "locador" / "locatário") só se constarem no texto.
7) evidence_mentioned: provas/documentos citados (prints, contratos, BO, e-mails) sem inventar arquivos.
8) needs_confirmation: pontos que o advogado deve confirmar antes de usar em peça.
9) Cada item em parties, facts, requests e risks: confidence 0–1 coerente com a evidência; sourceText curto (trecho ou paráfrase).
10) Dados já preenchidos pelo advogado no formulário têm prioridade — organize e sugira, nunca substitua silenciosamente o que ele digitou.
11) Pré-processual sem CNJ não é lacuna — não exija número de processo se o texto disser que ainda não há autos.
12) Responda APENAS com um único objeto JSON válido, sem markdown.`;

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
        "\n\nDevolva JSON com: parties, facts, requests, risks, timeline, missing_documents, missing_questions, information_gaps, next_steps, case_summary, legal_area_suggestion, urgency_score, readiness_score, party_relations, evidence_mentioned, needs_confirmation.",
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
