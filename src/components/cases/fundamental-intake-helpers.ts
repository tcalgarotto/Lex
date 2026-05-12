import type { FundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { digitsOnly } from "@/lib/forms/legal-input-masks";

export type IntakeSectionId =
  | "attend"
  | "client"
  | "opposing"
  | "third"
  | "narrative"
  | "timeline"
  | "documents"
  | "goals"
  | "communication";

export type SectionUiStatus = "complete" | "incomplete" | "lacuna";

export const SECTION_ANCHOR: Record<IntakeSectionId, string> = {
  attend: "section-attend",
  client: "section-client",
  opposing: "section-opposing",
  third: "section-third",
  narrative: "section-narrative",
  timeline: "section-timeline",
  documents: "section-documents",
  goals: "section-goals",
  communication: "section-communication",
};

export function cnjVisualError(cnj: string): string | null {
  const d = digitsOnly(cnj);
  if (!cnj.trim()) return null;
  if (d.length !== 20) {
    return "Número CNJ inválido. Use o padrão 0000000-00.0000.0.00.0000.";
  }
  return null;
}

function hasNarrative(form: FundamentalIntakeForm): boolean {
  if (form.freeNarrativeOnly && (form.narrative.freeText ?? "").trim().length >= 20) return true;
  if ((form.narrative.whatHappened ?? "").trim().length >= 10) return true;
  if ((form.narrative.freeText ?? "").trim().length >= 20) return true;
  return (form.timeline ?? []).some((r) => (r.event ?? "").trim().length >= 8);
}

function clientName(form: FundamentalIntakeForm): string {
  return form.clientKind === "PERSON"
    ? (form.clientPerson?.fullName ?? "").trim()
    : (form.clientCompany?.legalName ?? "").trim();
}

export function pendingRequiredLabels(form: FundamentalIntakeForm): string[] {
  const out: string[] = [];
  if ((form.attend.suggestedTitle ?? "").trim().length < 2) out.push("Título sugerido do caso");
  if ((form.attend.city ?? "").trim().length < 1) out.push("Cidade do caso");
  if ((form.attend.uf ?? "").trim().length < 2) out.push("UF do caso");
  if (clientName(form).length < 2) out.push("Nome do cliente (autor)");
  if (!hasNarrative(form)) out.push("Relato principal ou linha do tempo");
  if (cnjVisualError(form.attend.cnj)) out.push("CNJ (corrigir formato)");
  return out;
}

export function lacunaLabels(form: FundamentalIntakeForm): string[] {
  const out: string[] = [];
  if (form.opposing.unknown) out.push("Parte contrária ainda desconhecida");
  const cpf = digitsOnly(form.clientPerson?.cpf ?? "");
  if (form.clientKind === "PERSON" && cpf.length === 0) out.push("CPF do cliente não informado");
  const cnpj = digitsOnly(form.clientCompany?.cnpj ?? "");
  if (form.clientKind === "COMPANY" && cnpj.length === 0) out.push("CNPJ não informado");
  return out;
}

export function interviewProgressPercent(form: FundamentalIntakeForm): number {
  let p = 0;
  if ((form.attend.suggestedTitle ?? "").trim().length >= 2) p += 8;
  if ((form.attend.city ?? "").trim() && (form.attend.uf ?? "").trim().length === 2) p += 10;
  if (clientName(form).length >= 2) p += 15;
  if (hasNarrative(form)) p += 22;
  if (!form.opposing.unknown && (form.opposing.parties ?? []).some((x) => (x.name ?? "").trim().length > 1)) p += 10;
  if (form.opposing.unknown) p += 4;
  if ((form.goals.clientWants ?? "").trim().length > 5) p += 8;
  if (Object.values(form.documents.checklist ?? {}).some(Boolean)) p += 7;
  if ((form.communication.preferredChannel ?? "").length) p += 5;
  if ((form.thirdParties.beneficiary ?? "").trim() || (form.thirdParties.witnesses ?? "").trim()) p += 5;
  if ((form.attend.intakeDate ?? "").trim()) p += 5;
  if (!cnjVisualError(form.attend.cnj) && digitsOnly(form.attend.cnj).length === 20) p += 5;
  return Math.min(100, Math.round(p));
}

function sectionAttend(form: FundamentalIntakeForm): SectionUiStatus {
  const ok =
    (form.attend.suggestedTitle ?? "").trim().length >= 2 &&
    (form.attend.city ?? "").trim().length > 0 &&
    (form.attend.uf ?? "").trim().length === 2 &&
    !cnjVisualError(form.attend.cnj);
  return ok ? "complete" : "incomplete";
}

function sectionClient(form: FundamentalIntakeForm): SectionUiStatus {
  return clientName(form).length >= 2 ? "complete" : "incomplete";
}

function sectionOpposing(form: FundamentalIntakeForm): SectionUiStatus {
  if (form.opposing.unknown) return "lacuna";
  const named = (form.opposing.parties ?? []).some((x) => (x.name ?? "").trim().length > 1);
  return named ? "complete" : "lacuna";
}

export function sectionStatuses(form: FundamentalIntakeForm): Record<IntakeSectionId, SectionUiStatus> {
  const narrativeOk = hasNarrative(form);
  const timelineOk = (form.timeline ?? []).length > 0 && (form.timeline ?? []).some((r) => (r.event ?? "").trim());
  return {
    attend: sectionAttend(form),
    client: sectionClient(form),
    opposing: sectionOpposing(form),
    third:
      Object.values(form.thirdParties).some((v) => (v ?? "").trim().length > 2) || narrativeOk
        ? "complete"
        : "incomplete",
    narrative: narrativeOk ? "complete" : "incomplete",
    timeline: narrativeOk || timelineOk ? "complete" : "incomplete",
    documents: Object.values(form.documents.checklist ?? {}).some(Boolean) ? "complete" : "incomplete",
    goals: (form.goals.clientWants ?? "").trim().length > 5 ? "complete" : "incomplete",
    communication: "complete",
  };
}

const NAV_ORDER: IntakeSectionId[] = [
  "attend",
  "client",
  "opposing",
  "third",
  "narrative",
  "timeline",
  "documents",
  "goals",
  "communication",
];

export function nextRecommendedSection(form: FundamentalIntakeForm): IntakeSectionId {
  const st = sectionStatuses(form);
  for (const id of NAV_ORDER) {
    if (st[id] !== "complete") return id;
  }
  return "communication";
}

export function toggleSectionConfirmed(
  paths: string[] | undefined,
  section: IntakeSectionId,
  on: boolean,
): string[] {
  const key = `section:${section}`;
  const s = new Set(paths ?? []);
  if (on) s.add(key);
  else s.delete(key);
  return Array.from(s);
}
