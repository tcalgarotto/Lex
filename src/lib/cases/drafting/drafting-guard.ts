/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { CasePartyRole } from "@prisma/client";
import type { CaseBrainSnapshot } from "@/lib/cases/drafting/case-brain-shim";
import type { PinnedFoundationListItem, PinnedJurisprudenceListItem } from "@/lib/cases/drafting/drafting-types";

export type DraftingGuardInput = {
  snapshot: CaseBrainSnapshot;
  pinnedFoundations: PinnedFoundationListItem[];
  jurisprudenceCandidates: PinnedJurisprudenceListItem[];
  confirmUnverifiedFoundations?: boolean;
  /** Quando há estratégia P0 salva, exige aprovação explícita antes da minuta. */
  draftingStrategyApproved?: boolean;
  draftingStrategyExists?: boolean;
};

export function runDraftingGuard(input: DraftingGuardInput): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.draftingStrategyExists) {
    reasons.push(
      "Gere a estratégia assistida (DeepSeek) na aba Estratégia e Peças antes de redigir a minuta.",
    );
  } else if (!input.draftingStrategyApproved) {
    reasons.push("Aprove a estratégia assistida antes de redigir a minuta.");
  }

  const hasAuthor =
    input.snapshot.parties.some((p) => p.role === CasePartyRole.AUTHOR) ||
    (input.snapshot.brain?.parties.some((p) => p.role === "assisted_party") ?? false);

  if (!hasAuthor) {
    reasons.push("Confirme ao menos uma parte autora antes de gerar a minuta.");
  }

  const hasCoreFact =
    input.snapshot.facts.length > 0 || (input.snapshot.brain?.facts.length ?? 0) > 0;
  if (!hasCoreFact) {
    reasons.push("Registre ao menos um fato essencial confirmado antes de gerar a minuta.");
  }

  if (input.pinnedFoundations.length < 1) {
    reasons.push("Fixe ao menos um fundamento jurídico na pesquisa do caso antes de gerar a minuta.");
  }

  const unverifiedPins = input.pinnedFoundations.filter(
    (f) => f.verificationStatus === "AI_RECOMMENDED_UNVERIFIED",
  );
  if (unverifiedPins.length > 0 && !input.confirmUnverifiedFoundations) {
    reasons.push(
      "Há fundamento com indicação automática ainda sem confirmação explícita. Marque a confirmação na tela ou revise os pins antes de gerar.",
    );
  }

  const unverifiedJuris = input.jurisprudenceCandidates.filter(
    (j) => j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED",
  );
  if (unverifiedJuris.length > 0 && !input.confirmUnverifiedFoundations) {
    reasons.push(
      "Há julgado candidato ainda sem confirmação explícita. Confirme na tela para prosseguir ou remova da seleção.",
    );
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

/** Prévia para banner (espelha as mensagens do guard sem chamar o servidor). */
export function previewDraftingGuardMessages(input: {
  hasAuthor: boolean;
  hasFact: boolean;
  pinCount: number;
  hasUnverifiedFoundation: boolean;
  hasUnverifiedJuris: boolean;
  confirmUnverified?: boolean;
  draftingStrategyExists?: boolean;
  draftingStrategyApproved?: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!input.draftingStrategyExists) {
    reasons.push(
      "Gere a estratégia assistida (DeepSeek) na aba Estratégia e Peças antes de redigir a minuta.",
    );
  } else if (!input.draftingStrategyApproved) {
    reasons.push("Aprove a estratégia assistida antes de redigir a minuta.");
  }
  if (!input.hasAuthor) {
    reasons.push("Confirme ao menos uma parte autora antes de gerar a minuta.");
  }
  if (!input.hasFact) {
    reasons.push("Registre ao menos um fato essencial confirmado antes de gerar a minuta.");
  }
  if (input.pinCount < 1) {
    reasons.push("Fixe ao menos um fundamento jurídico na pesquisa do caso antes de gerar a minuta.");
  }
  if (input.hasUnverifiedFoundation && !input.confirmUnverified) {
    reasons.push(
      "Há fundamento com indicação automática ainda sem confirmação explícita. Marque a confirmação na tela ou revise os pins antes de gerar.",
    );
  }
  if (input.hasUnverifiedJuris && !input.confirmUnverified) {
    reasons.push(
      "Há julgado candidato ainda sem confirmação explícita. Confirme na tela para prosseguir ou remova da seleção.",
    );
  }
  return reasons;
}
