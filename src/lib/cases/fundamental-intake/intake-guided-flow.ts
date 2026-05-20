import type { IntakeSectionId, SectionUiStatus } from "@/components/cases/fundamental-intake-helpers";

/** Etapas visíveis na entrevista guiada (produto). */
export type IntakeGuidedStepId =
  | "narrative"
  | "parties"
  | "timeline"
  | "documents"
  | "communication"
  | "urgency"
  | "objective"
  | "process";

export type IntakeGuidedStep = {
  id: IntakeGuidedStepId;
  label: string;
  description: string;
  /** Seções do formulário cobertas por esta etapa. */
  sections: IntakeSectionId[];
  /** Primeira seção para scroll. */
  scrollTo: IntakeSectionId | "review";
};

export const INTAKE_GUIDED_STEPS: IntakeGuidedStep[] = [
  {
    id: "narrative",
    label: "Relato inicial",
    description: "O que aconteceu, em linguagem do cliente.",
    sections: ["narrative"],
    scrollTo: "narrative",
  },
  {
    id: "parties",
    label: "Partes envolvidas",
    description: "Quem é o cliente e quem está do outro lado.",
    sections: ["client", "opposing", "third"],
    scrollTo: "client",
  },
  {
    id: "timeline",
    label: "Datas e cronologia",
    description: "Quando os fatos ocorreram, em ordem.",
    sections: ["timeline"],
    scrollTo: "timeline",
  },
  {
    id: "documents",
    label: "Documentos e provas",
    description: "O que já existe para comprovar o relato.",
    sections: ["documents"],
    scrollTo: "documents",
  },
  {
    id: "communication",
    label: "Comunicações",
    description: "WhatsApp, e-mail, protocolos e notificações.",
    sections: ["communication"],
    scrollTo: "communication",
  },
  {
    id: "urgency",
    label: "Urgência",
    description: "Prazos, riscos imediatos e prescrição.",
    sections: ["goals"],
    scrollTo: "goals",
  },
  {
    id: "objective",
    label: "Objetivo do cliente",
    description: "Resultado desejado na demanda.",
    sections: ["goals"],
    scrollTo: "goals",
  },
  {
    id: "process",
    label: "Processo judicial?",
    description: "Autos já existentes (CNJ) ou caso pré-processual.",
    sections: ["attend"],
    scrollTo: "attend",
  },
];

export const INTAKE_REVIEW_ANCHOR = "section-review";

/** Agrega status das seções internas (pior caso: incomplete > lacuna > complete). */
export function guidedStepStatus(
  step: IntakeGuidedStep,
  sectionStatuses: Record<IntakeSectionId, SectionUiStatus>,
): SectionUiStatus {
  const statuses = step.sections.map((s) => sectionStatuses[s] ?? "incomplete");
  if (statuses.some((s) => s === "incomplete")) return "incomplete";
  if (statuses.some((s) => s === "lacuna")) return "lacuna";
  return "complete";
}
