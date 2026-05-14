/**
 * Modelo puro do progresso por fases do caso (10 etapas em 4 fases).
 * Usado pelo cabeçalho operacional e por qualquer UI compacta.
 */

export type CaseProgressInput = {
  documents: Array<{ status: string; updatedAt?: Date | string | number }>;
  facts: { id: string }[];
  parties: { id: string }[];
  requests: { id: string }[];
  legalSources: { id: string }[];
  drafts: { id: string }[];
  reviews: { id: string }[];
  metadataJson: unknown;
};

export type StepStatus = "done" | "pending" | "blocked";

export type Step = {
  label: string;
  status: StepStatus;
};

export type Phase = {
  name: string;
  steps: Step[];
};

export function hasBrain(m: unknown): boolean {
  if (!m || typeof m !== "object") return false;
  return !!(m as { brain?: unknown }).brain;
}

export function hasStrategy(m: unknown): boolean {
  if (!m || typeof m !== "object") return false;
  return !!(m as { strategy?: unknown }).strategy;
}

function st(ok: boolean, blocked?: boolean): StepStatus {
  return ok ? "done" : blocked ? "blocked" : "pending";
}

export function buildPhases(c: CaseProgressInput): Phase[] {
  const docsCount = c.documents.length;
  const docsIndexed = c.documents.filter((d) => d.status === "INDEXED").length;
  const docsFailed = c.documents.filter((d) => d.status === "FAILED").length;

  return [
    {
      name: "Início",
      steps: [
        { label: "Caso criado", status: "done" },
        { label: "Documento enviado", status: st(docsCount > 0) },
      ],
    },
    {
      name: "Processamento",
      steps: [
        {
          label: "Documento processado",
          status: st(
            docsIndexed > 0,
            docsFailed > 0 && docsCount === docsFailed,
          ),
        },
        { label: "Fatos extraídos", status: st(c.facts.length > 0) },
        { label: "Partes identificadas", status: st(c.parties.length > 0) },
        { label: "Pedidos identificados", status: st(c.requests.length > 0) },
      ],
    },
    {
      name: "Inteligência",
      steps: [
        {
          label: "Inteligência do caso",
          status: st(hasBrain(c.metadataJson)),
        },
        {
          label: "Fundamentos pinados",
          status: st(c.legalSources.length > 0),
        },
      ],
    },
    {
      name: "Produção",
      steps: [
        { label: "Estratégia gerada", status: st(hasStrategy(c.metadataJson)) },
        {
          label: c.reviews.length > 0 ? "Peça revisada" : "Peça gerada",
          status: st(c.reviews.length > 0 || c.drafts.length > 0),
        },
      ],
    },
  ];
}

export function computeProgressMetrics(phases: Phase[]) {
  const allSteps = phases.flatMap((p) => p.steps);
  const doneCount = allSteps.filter((s) => s.status === "done").length;
  const total = allSteps.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const nextStep = allSteps.find((s) => s.status !== "done");
  return { allSteps, doneCount, total, pct, nextStep };
}

/** Texto imperativo para “Próximo passo” (ordem de ação), alinhado ao rótulo da etapa no modelo. */
const STEP_NEXT_ACTION: Record<string, string> = {
  "Caso criado": "Continuar o caso",
  "Documento enviado": "Enviar documento",
  "Documento processado": "Concluir processamento dos documentos",
  "Fatos extraídos": "Extrair fatos",
  "Partes identificadas": "Identificar partes",
  "Pedidos identificados": "Identificar pedidos",
  "Inteligência do caso": "Gerar inteligência do caso",
  "Fundamentos pinados": "Pinar fundamentos jurídicos",
  "Estratégia gerada": "Gerar estratégia",
  "Peça gerada": "Gerar peça",
  "Peça revisada": "Revisar peça",
};

export function getNextStepCallToAction(step: Step | null): string {
  if (!step) return "Todas as etapas concluídas";
  return STEP_NEXT_ACTION[step.label] ?? `Concluir: ${step.label}`;
}
