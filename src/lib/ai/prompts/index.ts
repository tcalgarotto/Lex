import type { RetrievedChunk } from "@/lib/retrieval/hybrid-retriever";

export const PROMPT_VERSION = "lex-v1";

export const SYSTEM_BASE = `Você é Lex, copiloto jurídico brasileiro para advogados.
Regras obrigatórias:
- Baseie-se apenas nas fontes fornecidas na seção FONTES. Se algo não estiver nas fontes, diga claramente que não há base documental suficiente.
- Use linguagem jurídica técnica em português do Brasil.
- Ao citar trechos, use o formato [fonte:N] correspondente à lista numerada de FONTES.
- Não invente números de processo, datas ou ementas.
- Se o usuário pedir peça processual completa, estruture com seções típicas (preâmbulo, fatos, direito, pedidos) quando aplicável.`;

export function styleInjection(profileJson: unknown): string {
  if (!profileJson || typeof profileJson !== "object") return "";
  const p = profileJson as Record<string, unknown>;
  const rawPhrases = p["frases_recorrentes"];
  const phrases = Array.isArray(rawPhrases) ? (rawPhrases as string[]).slice(0, 8) : [];
  return `Perfil de estilo do advogado (use como guia de tom e estrutura, sem copiar literalmente se não fizer sentido):
- formalidade: ${String(p["formalidade"] ?? "alta")}
- doutrina: ${String(p["doutrina"] ?? "moderada")}
- jurisprudência: ${String(p["jurisprudencia"] ?? "moderada")}
- tom: ${String(p["tom"] ?? "técnico")}
- frases recorrentes sugeridas: ${phrases.join("; ") || "(nenhuma ainda)"}`;
}

export function groundingFromChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "FONTES: (nenhuma recuperada — informe ao usuário).";
  const lines = chunks.map((c, i) => {
    const meta = [
      c.sourceLabel,
      c.meta["articleRef"],
      c.meta["tribunal"],
      c.meta["sourceCode"],
    ]
      .filter(Boolean)
      .join(" · ");
    return `[fonte:${i + 1}] (${c.layer}) ${meta}\n${c.text}`;
  });
  return `FONTES numeradas — cite apenas com [fonte:N]:\n\n${lines.join("\n\n---\n\n")}`;
}

export function chatContextualPrompt(params: {
  processSummary: string;
  memoryBlock: string;
  styleBlock: string;
  grounding: string;
}): string {
  return `CONTEXTO DO PROCESSO:\n${params.processSummary}\n\nMEMÓRIA PERSISTENTE:\n${params.memoryBlock}\n\n${params.styleBlock}\n\n${params.grounding}`;
}

export const PIECE_OUTLINE = `Gere um outline JSON (apenas JSON válido, sem markdown) para a peça solicitada.
Campos: { "sections": [ { "id": string, "title": string, "goal": string } ] }
Limit 4 a 8 seções.`;

export const PIECE_SECTION = `Redija apenas a seção indicada, em português jurídico, citando [fonte:N] quando usar FONTES.`;

export const EDITOR_REWRITE = `Reescreva o trecho mantendo o sentido e elevando a fundamentação, com tom alinhado ao perfil de estilo. Use [fonte:N] se FONTES forem fornecidas.`;
