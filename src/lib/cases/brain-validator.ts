/**
 * Validador determinístico para o output do LLM no pipeline do
 * Case Brain (F2). Garante que cada item extraído tenha
 * `sourceText`, `confidence` e `origin` — sem isso, descarta.
 *
 * Não usa o LLM. Roda 100% offline e nunca falha — apenas filtra
 * itens inválidos. O caller decide o que fazer com `degraded=true`.
 */

import { z } from "zod";
import type {
  BrainAuthority,
  BrainEvidence,
  BrainFact,
  BrainParty,
  BrainPartyRole,
  BrainRequest,
  BrainRequestKind,
  BrainRisk,
  BrainRiskSeverity,
  CaseBrain,
  CaseBrainPhase,
  ProbableMeasureKind,
  SuggestedFoundation,
} from "./brain-types";

/* --------------------- min confidence threshold ------------------------ */

const MIN_CONFIDENCE = 0.4;

/* --------------------------- zod schemas ------------------------------- */

const PartyRoleSchema = z.enum([
  "assisted_party",
  "child_or_dependent",
  "opposing_party",
  "authority",
  "third_party",
  "other",
]);

const PhaseSchema = z.enum([
  "pre_processual",
  "judicial",
  "recursal",
  "execucao",
  "outro",
]);

const ProbableMeasureKindSchema = z.enum([
  "MS",
  "OBRIGACAO_FAZER",
  "INDENIZATORIA",
  "DECLARATORIA",
  "POSSESSORIA",
  "EXECUCAO",
  "MEDIDA_CAUTELAR",
  "OUTRO",
]);

const RequestKindSchema = z.enum([
  "URGENCY",
  "MAIN",
  "SUBSIDIARY",
  "PROVISIONAL",
  "EVIDENCE",
  "PROCEDURAL",
  "OTHER",
]);

const RiskSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const ExtractedItemMetaSchema = z.object({
  sourceText: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  origin: z.string().min(1).max(120),
});

const PartySchema = z
  .object({
    role: PartyRoleSchema,
    name: z.string().min(1).max(200),
    document: z.string().max(60).optional(),
    contact: z.string().max(120).optional(),
    address: z.string().max(400).optional(),
    age: z.number().int().min(0).max(150).optional(),
    relationship: z.string().max(80).optional(),
  })
  .merge(ExtractedItemMetaSchema);

const AuthoritySchema = z
  .object({
    name: z.string().min(1).max(200),
    role: z.string().max(120),
    entity: z.string().max(200),
  })
  .merge(ExtractedItemMetaSchema);

const FactSchema = z
  .object({
    text: z.string().min(1).max(2000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    evidenceRefs: z.array(z.string()).max(20).default([]),
  })
  .merge(ExtractedItemMetaSchema);

const RequestSchema = z
  .object({
    text: z.string().min(1).max(2000),
    kind: RequestKindSchema,
  })
  .merge(ExtractedItemMetaSchema);

const RiskSchema = z
  .object({
    title: z.string().min(1).max(200),
    detail: z.string().min(1).max(1000),
    severity: RiskSeveritySchema,
    mitigation: z.string().max(500).optional(),
  })
  .merge(ExtractedItemMetaSchema);

const EvidenceSchema = z
  .object({
    kind: z.string().min(1).max(80),
    ref: z.string().max(200).optional(),
  })
  .merge(ExtractedItemMetaSchema);

const SuggestedFoundationSchema = z.object({
  urn: z.string().max(300).optional(),
  articleRef: z.string().max(60).optional(),
  rationale: z.string().min(1).max(500),
});

const ProbableMeasureSchema = z.object({
  kind: ProbableMeasureKindSchema,
  rationale: z.string().min(1).max(500),
  sourceText: z.string().max(1000).optional(),
});

const BrainBaseSchema = z.object({
  title: z.string().min(1).max(240),
  area: z.array(z.string().min(1).max(80)).max(8).default([]),
  phase: PhaseSchema,
  problem: z.string().min(1).max(2000),
  objective: z.string().min(1).max(2000),
  thesis: z.string().min(1).max(2000),
  probableMeasure: ProbableMeasureSchema,
  narrative: z.string().max(4000),
  parties: z.array(PartySchema).max(40).default([]),
  probableAuthority: AuthoritySchema.optional(),
  facts: z.array(FactSchema).max(50).default([]),
  requests: z.array(RequestSchema).max(40).default([]),
  risks: z.array(RiskSchema).max(20).default([]),
  evidence: z.array(EvidenceSchema).max(60).default([]),
  missingDocuments: z.array(z.string().min(1).max(200)).max(40).default([]),
  suggestedFoundations: z.array(SuggestedFoundationSchema).max(40).default([]),
  inconsistencies: z
    .array(
      z.object({
        kind: z.string().min(1).max(80),
        description: z.string().min(1).max(500),
        evidence: z.string().max(1000),
      }),
    )
    .max(40)
    .default([]),
});

export type ValidatorOutput = {
  valid: boolean;
  /** Versão saneada do brain. Pode ter listas vazias se input falhou em campos opcionais. */
  partial: Omit<CaseBrain, "brainVersion" | "inputHash" | "proceduralReadiness" | "generatedAt">;
  /** Lista de problemas encontrados (não fatais) — ajuda debug. */
  warnings: string[];
};

/**
 * Valida e sanea o output do LLM. Sempre devolve `partial` com a melhor
 * estrutura possível — itens inválidos são descartados, não fatais.
 *
 * @param input objeto vindo do LLM, JSON.parse aplicado.
 * @param sourceText texto-fonte completo (rawInput + docs concat) usado
 *                   para verificação cruzada (sourceText real?).
 */
export function validateBrain(input: unknown, sourceText: string): ValidatorOutput {
  const warnings: string[] = [];

  const parsed = BrainBaseSchema.safeParse(input);
  if (!parsed.success) {
    warnings.push(`Schema inválido: ${parsed.error.issues.length} erros`);
    // Mesmo com falha, tentamos consertar partes individuais.
    const fallback: ValidatorOutput["partial"] = {
      title: pickStringOr(input, "title", "Caso sem título"),
      area: [],
      phase: "pre_processual",
      problem: pickStringOr(input, "problem", ""),
      objective: pickStringOr(input, "objective", ""),
      thesis: pickStringOr(input, "thesis", ""),
      probableMeasure: { kind: "OUTRO", rationale: "Não foi possível extrair." },
      narrative: pickStringOr(input, "narrative", ""),
      parties: [],
      facts: [],
      requests: [],
      risks: [],
      evidence: [],
      missingDocuments: [],
      suggestedFoundations: [],
      inconsistencies: [],
    };
    return { valid: false, partial: fallback, warnings };
  }

  const data = parsed.data;
  const lowerSource = sourceText.toLowerCase();

  function keepItem<T extends { sourceText: string; confidence: number }>(
    arr: T[],
    label: string,
  ): T[] {
    const before = arr.length;
    const kept = arr.filter((item) => {
      if (item.confidence < MIN_CONFIDENCE) return false;
      // Aceita item cujo sourceText realmente exista no texto-fonte
      // (case-insensitive, com tolerância a whitespace).
      const needle = item.sourceText.toLowerCase().replace(/\s+/g, " ").trim();
      if (needle.length < 4) return true; // referência muito curta — não dá pra bloquear
      const hay = lowerSource.replace(/\s+/g, " ");
      return hay.includes(needle.slice(0, Math.min(needle.length, 80)));
    });
    if (kept.length < before) {
      warnings.push(
        `${label}: ${before - kept.length} itens descartados (confiança<${MIN_CONFIDENCE} ou sourceText ausente)`,
      );
    }
    return kept;
  }

  // Verificação cruzada: pedidos não podem ser idênticos a fatos.
  const factTexts = new Set(data.facts.map((f) => f.text.toLowerCase().trim()));
  const requestsFiltered = data.requests.filter((r) => {
    if (factTexts.has(r.text.toLowerCase().trim())) {
      warnings.push(`Pedido descartado por colidir com fato: "${r.text.slice(0, 80)}"`);
      return false;
    }
    return true;
  });

  const partial: ValidatorOutput["partial"] = {
    title: data.title,
    area: data.area,
    phase: data.phase as CaseBrainPhase,
    problem: data.problem,
    objective: data.objective,
    thesis: data.thesis,
    probableMeasure: {
      kind: data.probableMeasure.kind as ProbableMeasureKind,
      rationale: data.probableMeasure.rationale,
      ...(data.probableMeasure.sourceText
        ? { sourceText: data.probableMeasure.sourceText }
        : {}),
    },
    narrative: data.narrative,
    parties: keepItem(data.parties as BrainParty[], "parties").map((p) => ({
      ...p,
      role: p.role as BrainPartyRole,
    })),
    ...(data.probableAuthority
      ? {
          probableAuthority: data.probableAuthority as BrainAuthority,
        }
      : {}),
    facts: keepItem(data.facts as BrainFact[], "facts"),
    requests: keepItem(requestsFiltered as BrainRequest[], "requests").map((r) => ({
      ...r,
      kind: r.kind as BrainRequestKind,
    })),
    risks: keepItem(data.risks as BrainRisk[], "risks").map((r) => ({
      ...r,
      severity: r.severity as BrainRiskSeverity,
    })),
    evidence: keepItem(data.evidence as BrainEvidence[], "evidence"),
    missingDocuments: data.missingDocuments,
    suggestedFoundations: data.suggestedFoundations as SuggestedFoundation[],
    inconsistencies: data.inconsistencies,
  };

  return { valid: true, partial, warnings };
}

function pickStringOr(input: unknown, key: string, fallback: string): string {
  if (input && typeof input === "object" && key in input) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return fallback;
}
