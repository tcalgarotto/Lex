/**
 * Tipagem do Case Brain — inteligência consolidada do caso (F2).
 *
 * Cada item carrega `sourceText`, `confidence` e `origin` para auditoria —
 * o usuário advogado precisa saber DE ONDE veio cada informação (relato
 * livre, checklist, documento específico, busca no acervo, nota manual).
 */

export type ExtractedItemMeta = {
  /** Trecho literal do texto-fonte que justifica a extração. */
  sourceText: string;
  /** 0..1 — quanto o sistema confia na extração. */
  confidence: number;
  /**
   * Origem auditável da informação. `document:<id>` permite vincular a
   * extração ao Documento específico que a originou.
   */
  origin:
    | "input"
    | "user_command"
    | "checklist"
    | "manual_note"
    | "rag"
    | `document:${string}`;
};

export type ExtractedItem<T> = T & ExtractedItemMeta;

export type CaseBrainPhase =
  | "pre_processual"
  | "judicial"
  | "recursal"
  | "execucao"
  | "outro";

export type ProbableMeasureKind =
  | "MS"
  | "OBRIGACAO_FAZER"
  | "INDENIZATORIA"
  | "DECLARATORIA"
  | "POSSESSORIA"
  | "EXECUCAO"
  | "MEDIDA_CAUTELAR"
  | "OUTRO";

export type ProbableMeasure = {
  kind: ProbableMeasureKind;
  rationale: string;
  sourceText?: string;
};

export type BrainPartyRole =
  | "assisted_party"      // cliente (parte autora típica)
  | "child_or_dependent"  // criança/menor/dependente protegido
  | "opposing_party"      // parte contrária
  | "authority"           // autoridade pública envolvida
  | "third_party"         // terceiro interessado
  | "other";

export type BrainParty = ExtractedItem<{
  role: BrainPartyRole;
  name: string;
  document?: string;       // CPF/CNPJ
  contact?: string;        // telefone/email
  address?: string;
  age?: number;
  relationship?: string;   // "mãe", "responsável", etc.
}>;

export type BrainAuthority = ExtractedItem<{
  name: string;
  role: string;
  entity: string;
}>;

export type BrainFact = ExtractedItem<{
  text: string;
  date?: string;          // ISO yyyy-mm-dd
  evidenceRefs: string[]; // documentIds
}>;

export type BrainRequestKind =
  | "URGENCY"
  | "MAIN"
  | "SUBSIDIARY"
  | "PROVISIONAL"
  | "EVIDENCE"
  | "PROCEDURAL"
  | "OTHER";

export type BrainRequest = ExtractedItem<{
  text: string;
  kind: BrainRequestKind;
}>;

export type BrainRiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BrainRisk = ExtractedItem<{
  title: string;
  detail: string;
  severity: BrainRiskSeverity;
  mitigation?: string;
}>;

export type BrainEvidence = ExtractedItem<{
  kind: string;
  ref?: string;
}>;

export type SuggestedFoundation = {
  urn?: string;
  articleRef?: string;
  rationale: string;
};

export type BrainInconsistency = {
  kind: string;
  description: string;
  evidence: string;
};

export type ProceduralReadinessStatus =
  | "insuficiente"
  | "parcial"
  | "boa"
  | "pronta_para_minuta";

/**
 * Prontidão processual (F2.2) — calculada por `computeProceduralReadiness`
 * com base no brain + checklist + documentos.
 */
export type ProceduralReadiness = {
  /** 0..100 — pontuação ponderada. */
  score: number;
  /** Faixa derivada do score (e/ou de blockers críticos). */
  status: ProceduralReadinessStatus;
  /** Pendências críticas que travam a peça. */
  blockers: string[];
  /** Documentos ainda não anexados (espelho/extensão de brain.missingDocuments). */
  missingDocuments: string[];
  /** Próxima ação humana sugerida em frase curta. */
  nextBestAction: string;
  /** Explicação humana do score (transparência). */
  rationale: string;
};

/**
 * Resposta a um checklist guiado (F2.1). Persistida dentro do brain.
 * `templateId` aponta para o template registrado em
 * `src/lib/cases/checklists/registry.ts`.
 */
export type ChecklistResponses = {
  templateId: string;
  version: number;
  /** Mapa fieldId -> valor (formatos variados conforme o tipo do campo). */
  answers: Record<string, unknown>;
  /** ISO timestamp da última atualização. */
  answeredAt: string;
};

export type CaseBrain = {
  /** Identificador estável da revisão deste brain (incrementa a cada execução). */
  brainVersion: number;
  /** Marca quando rodou o pipeline determinístico (sem LLM). */
  degraded?: boolean;
  /** Hash do input + docs — para cache idempotente. */
  inputHash: string;

  title: string;
  area: string[];
  phase: CaseBrainPhase;
  problem: string;
  objective: string;
  thesis: string;
  probableMeasure: ProbableMeasure;
  narrative: string;

  parties: BrainParty[];
  probableAuthority?: BrainAuthority;
  facts: BrainFact[];
  requests: BrainRequest[];
  risks: BrainRisk[];
  evidence: BrainEvidence[];
  missingDocuments: string[];
  suggestedFoundations: SuggestedFoundation[];
  inconsistencies: BrainInconsistency[];

  /** F2.2 — calculado pós-consolidação. */
  proceduralReadiness: ProceduralReadiness;

  /** F2.1 — quando entrevista guiada/checklist foi usado. */
  checklistResponses?: ChecklistResponses;

  /** ISO timestamp da última consolidação. */
  generatedAt: string;
};
