import type { FundamentalIntakeForm } from "./form-schema";
import { digitsOnly } from "@/lib/forms/legal-input-masks";

export type ComplementCheckItem = {
  id: string;
  question: string;
  status: "answered" | "partial" | "missing";
  hint?: string;
};

function clientName(form: FundamentalIntakeForm): string {
  return form.clientKind === "PERSON"
    ? (form.clientPerson?.fullName ?? "").trim()
    : (form.clientCompany?.legalName ?? "").trim();
}

/**
 * Checklist determinístico (MVP) — espelha perguntas que o advogado deve cobrir na entrevista.
 */
export function buildIntakeComplementChecklist(form: FundamentalIntakeForm): ComplementCheckItem[] {
  const ch = form.documents.checklist ?? {};
  const hasOpposing =
    form.opposing.unknown ||
    (form.opposing.parties ?? []).some((p) => (p.name ?? "").trim().length > 1);
  const hasWhen =
    (form.narrative.whenHappened ?? "").trim().length > 2 ||
    (form.timeline ?? []).some((r) => (r.date ?? "").trim().length > 0);
  const hasWhere = (form.narrative.whereHappened ?? "").trim().length > 2;
  const hasNarrative =
    (form.narrative.whatHappened ?? "").trim().length >= 10 ||
    (form.narrative.freeText ?? "").trim().length >= 20;

  const items: ComplementCheckItem[] = [
    {
      id: "client",
      question: "Quem é o cliente ou parte atendida?",
      status: clientName(form).length >= 2 ? "answered" : "missing",
    },
    {
      id: "opposing",
      question: "Quem é a outra parte?",
      status: form.opposing.unknown
        ? "partial"
        : hasOpposing
          ? "answered"
          : "missing",
      hint: form.opposing.unknown ? "Marcado como desconhecida — ok para pré-processual." : undefined,
    },
    {
      id: "what",
      question: "O que aconteceu?",
      status: hasNarrative ? "answered" : "missing",
    },
    {
      id: "when",
      question: "Quando aconteceu?",
      status: hasWhen ? "answered" : "missing",
    },
    {
      id: "where",
      question: "Onde aconteceu?",
      status: hasWhere ? "answered" : "partial",
    },
    {
      id: "contract",
      question: "Há contrato?",
      status: ch.contract ? "answered" : "missing",
    },
    {
      id: "whatsapp",
      question: "Há conversas de WhatsApp ou e-mail?",
      status: ch.whatsappPrints || ch.emails ? "answered" : "missing",
    },
    {
      id: "proofs",
      question: "Há comprovantes, prints, fotos ou documentos?",
      status:
        ch.paymentProof ||
        ch.photos ||
        ch.personalId ||
        ch.protocols ||
        (form.documents.documentIds?.length ?? 0) > 0
          ? "answered"
          : "missing",
    },
    {
      id: "notification",
      question: "Houve notificação ou intimação?",
      status: ch.courtOrder || ch.protocols ? "answered" : "missing",
    },
    {
      id: "process",
      question: "Já existe processo judicial (CNJ)?",
      status:
        form.attend.preOrProcess === "existing_process"
          ? digitsOnly(form.attend.cnj).length === 20
            ? "answered"
            : "partial"
          : form.attend.preOrProcess === "pre_processual"
            ? "answered"
            : "missing",
      hint:
        form.attend.preOrProcess === "pre_processual"
          ? "Caso pré-processual — CNJ não é obrigatório."
          : undefined,
    },
    {
      id: "urgency",
      question: "Qual é a urgência?",
      status:
        form.goals.prescriptionRisk ||
        form.goals.evidenceLossRisk ||
        form.goals.immediateDamageRisk ||
        form.goals.urgency ||
        form.goals.deadlineExpiring ||
        form.goals.hearingOrSummons
          ? "answered"
          : "partial",
    },
    {
      id: "objective",
      question: "Qual resultado o cliente deseja?",
      status: (form.goals.clientWants ?? "").trim().length > 5 ? "answered" : "missing",
    },
    {
      id: "prove",
      question: "O que ainda precisa ser provado?",
      status:
        (form.goals.unfavorableFacts && (form.narrative.damage ?? "").trim().length > 3) ||
        form.goals.evidenceLossRisk
          ? "answered"
          : "partial",
    },
  ];

  return items;
}
