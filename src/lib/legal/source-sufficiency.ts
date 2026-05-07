import type { RetrievedChunk } from "@/lib/retrieval/types";
import type { LegalQueryType, QueryClassification } from "@/lib/legal/query-classifier";

export type SourceSufficiencyLevel = "high" | "medium" | "low";

export type SourceSufficiencyResult = {
  sufficient: boolean;
  level: SourceSufficiencyLevel;
  reasons: string[];
  warnings: string[];
};

function countBy<T extends string>(xs: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

export function evaluateSourceSufficiency(params: {
  classification: QueryClassification;
  retrievedChunks: RetrievedChunk[];
  processId?: string;
  documentId?: string;
}): SourceSufficiencyResult {
  const { retrievedChunks, classification } = params;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const types = retrievedChunks.map((c) => c.sourceType);
  const byType = countBy(types);
  const hasAny = (t: keyof typeof byType) => (byType[t] ?? 0) > 0;

  const hasProcessDoc = hasAny("process_document");
  const hasLaw = hasAny("legislation");
  const hasJuris = hasAny("jurisprudence");
  const hasPiece = hasAny("legal_piece");
  const hasMemory = hasAny("process_memory");

  if (classification.requiresStrongSources && retrievedChunks.length === 0) {
    reasons.push("Nenhuma fonte foi recuperada para uma pergunta que exige base forte.");
    return { sufficient: false, level: "low", reasons, warnings };
  }

  const qt: LegalQueryType = classification.queryType;

  if (qt === "procedural_deadline") {
    if (!hasProcessDoc && !hasLaw) {
      reasons.push("Pergunta sobre prazo: preciso de um despacho/intimação do processo ou da base legal aplicável para afirmar com segurança.");
    }
    if (!hasProcessDoc) warnings.push("Não localizei despacho/intimação indexado no processo para confirmar marco inicial e forma de contagem.");
    if (!hasLaw) warnings.push("Não localizei base legal indexada para fundamentar a regra de contagem do prazo.");
  }

  if (qt === "document_summary") {
    if (!hasProcessDoc) reasons.push("Para resumir/interpretar 'este despacho/decisão', preciso do próprio documento do processo indexado.");
  }

  if (qt === "case_strategy" && classification.requiresProcessDocument) {
    if (!hasProcessDoc) {
      reasons.push("Pergunta estratégica contextual: não localizei despacho/decisão/documento do processo na base para orientar com segurança.");
    }
  }

  // legal_basis inclui pedidos de artigo/súmula/precedente/jurisprudência.
  if (qt === "legal_basis") {
    // Para jurisprudência, exigir pelo menos uma fonte jurisprudence.
    const askedJuris = classification.signals.includes("jurisprudence");
    if (askedJuris && !hasJuris) {
      reasons.push("Pedido de jurisprudência/precedente: não há jurisprudência indexada suficiente para sustentar uma afirmação verificável.");
    }
    if (!hasLaw && !hasJuris && !hasProcessDoc) {
      reasons.push("Fundamentação jurídica: não há legislação/jurisprudência/documento do processo suficiente na base para afirmar artigos/teses com segurança.");
    }
  }

  if (qt === "petition_generation") {
    // Pedido do usuário: precisa de documento OU memória do processo relevante (senão rascunho e warning forte)
    if (!hasProcessDoc && !hasMemory) {
      reasons.push("Geração de peça: não há documento do processo nem memória persistente suficiente para uma minuta segura.");
    }
    if (!hasProcessDoc) warnings.push("A minuta exige conferência humana antes de protocolo (não há documento do processo recuperado).");
    if (!hasLaw && !hasJuris) warnings.push("Não localizei legislação/jurisprudência indexada — evite afirmar artigos ou entendimentos consolidados.");
  }

  if (retrievedChunks.length > 0 && hasMemory && !hasProcessDoc && !hasLaw && !hasJuris && !hasPiece) {
    warnings.push("A resposta está baseada apenas em memória recente, sem documento processual indexado.");
  }

  const sufficient = reasons.length === 0;

  let level: SourceSufficiencyLevel = "high";
  if (!sufficient) level = "low";
  else if (retrievedChunks.length < 2) level = "medium";
  else if (!hasProcessDoc && (qt === "procedural_deadline" || qt === "document_summary")) level = "medium";
  else if (!hasLaw && qt === "legal_basis") level = "medium";
  else if (warnings.length) level = "medium";

  return { sufficient, level, reasons, warnings };
}

