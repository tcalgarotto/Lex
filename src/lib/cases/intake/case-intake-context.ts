/**
 * Lazy Intake P0.2 — contexto por tarefa jurídica.
 *
 * A entrevista inicial NÃO chama IA: persiste `metadataJson.intakeForm` + `Case.rawInput`.
 * IA sob demanda: pesquisar fundamentos, estratégia, minuta, organizar caso (opcional).
 * Fases seguintes ligam `buildCaseTaskContext` aos endpoints; aqui ficam os contratos e derivações.
 */

import type { CaseBrain } from "@/lib/cases/brain-types";
import type { CaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";
import { listPinnedFoundations } from "@/lib/cases/case-brain/pinned-foundations";
import { getCaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";
import {
  getCaseIntakeForm,
  isFundamentalIntakeStructured,
  parseFundamentalIntakeFromMetadata,
} from "@/lib/cases/case-intake-source";
import type { FundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { buildIntakeNarrativeForModel } from "@/lib/cases/fundamental-intake/build-narrative";
import { readCaseIntakeFundamentalMeta } from "@/lib/cases/case-intake-fundamental-meta";
import { prisma } from "@/lib/prisma";

export type { FundamentalIntakeForm };
export { getCaseIntakeForm, parseFundamentalIntakeFromMetadata, isFundamentalIntakeStructured };

export type CaseTaskType =
  | "legal_research"
  | "strategy"
  | "draft"
  | "organize_case"
  | "document_analysis"
  | "review";

export type DisplayParty = { role: string; name: string; detail?: string };
export type DisplayFact = { text: string; category?: string };
export type DisplayRequest = { text: string; kind?: string };
export type DisplayRisk = { title: string; detail: string; severity?: string };

/** Vista read-only para UI quando o caso ainda não foi organizado com Lex AI. */
export type CaseDisplaySnapshot = {
  source: "structured" | "intake_form" | "intake_structured";
  parties: DisplayParty[];
  facts: DisplayFact[];
  requests: DisplayRequest[];
  risks: DisplayRisk[];
  gaps: string[];
  pendingQuestions: string[];
  nextSteps: string[];
  partyRelations: Array<{ from: string; to: string; relation: string }>;
  evidenceMentioned: string[];
  needsConfirmation: string[];
  legalArea: string | null;
  clientObjective: string | null;
  insufficient: boolean;
};

export type CompactContextLimits = {
  maxStringLength?: number;
  maxArrayItems?: number;
};

const DEFAULT_LIMITS: Required<CompactContextLimits> = {
  maxStringLength: 6_000,
  maxArrayItems: 40,
};

/** Remove chaves vazias e trunca strings longas (economia de tokens nas tarefas com IA). */
export function compactContextPayload<T extends Record<string, unknown>>(
  input: T,
  limits: CompactContextLimits = {},
): Record<string, unknown> {
  const maxLen = limits.maxStringLength ?? DEFAULT_LIMITS.maxStringLength;
  const maxItems = limits.maxArrayItems ?? DEFAULT_LIMITS.maxArrayItems;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) continue;
      out[key] = t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
      continue;
    }
    if (Array.isArray(value)) {
      const items = value
        .filter((x) => x !== null && x !== undefined && String(x).trim() !== "")
        .slice(0, maxItems);
      if (items.length) out[key] = items;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = compactContextPayload(value as Record<string, unknown>, limits);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function brainHasContent(brain: CaseBrain | null | undefined): boolean {
  if (!brain) return false;
  return (
    (brain.parties?.length ?? 0) > 0 ||
    (brain.facts?.length ?? 0) > 0 ||
    (brain.requests?.length ?? 0) > 0 ||
    (brain.risks?.length ?? 0) > 0 ||
    Boolean(brain.narrative?.trim())
  );
}

/** Preferir brain só com conteúdo; senão tabelas; senão derivar do intakeForm. */
export function pickStructuredSource(args: {
  snap: CaseBrainSnapshot | null;
  intakeForm: FundamentalIntakeForm | null;
}): "brain" | "relational" | "intake_form" {
  if (brainHasContent(args.snap?.brain)) return "brain";
  if (
    (args.snap?.parties.length ?? 0) > 0 ||
    (args.snap?.facts.length ?? 0) > 0 ||
    (args.snap?.claims.length ?? 0) > 0
  ) {
    return "relational";
  }
  if (args.intakeForm) return "intake_form";
  return "relational";
}

function clientDisplayName(form: FundamentalIntakeForm): string {
  if (form.clientKind === "COMPANY") {
    return (form.clientCompany?.legalName ?? form.clientCompany?.tradeName ?? "").trim();
  }
  return (form.clientPerson?.fullName ?? "").trim();
}

function deriveDisplayFromIntakeForm(
  form: FundamentalIntakeForm,
  meta?: ReturnType<typeof readCaseIntakeFundamentalMeta>,
): CaseDisplaySnapshot {
  const parties: DisplayParty[] = [];
  const clientName = clientDisplayName(form);
  if (clientName) parties.push({ role: "Cliente / parte autora", name: clientName });

  if (!form.opposing?.unknown) {
    for (const op of form.opposing.parties ?? []) {
      const name = (op.name ?? "").trim();
      if (name) parties.push({ role: "Parte contrária", name, detail: op.relationToClient?.trim() || undefined });
    }
  }

  const facts: DisplayFact[] = [];
  const what = (form.narrative.whatHappened ?? "").trim();
  const when = (form.narrative.whenHappened ?? "").trim();
  const where = (form.narrative.whereHappened ?? "").trim();
  const damage = (form.narrative.damage ?? "").trim();
  if (what) facts.push({ text: what, category: "relato" });
  if (when) facts.push({ text: `Quando: ${when}`, category: "data" });
  if (where) facts.push({ text: `Onde: ${where}`, category: "local" });
  if (damage) facts.push({ text: damage, category: "dano" });
  for (const row of form.timeline ?? []) {
    const ev = (row.event ?? "").trim();
    if (!ev) continue;
    const prefix = (row.date ?? "").trim() ? `${row.date}: ` : "";
    facts.push({ text: `${prefix}${ev}`, category: "linha_do_tempo" });
  }

  const requests: DisplayRequest[] = [];
  const wants = (form.goals.clientWants ?? "").trim();
  if (wants) requests.push({ text: wants, kind: "principal" });
  const ideal = (form.goals.idealOutcome ?? "").trim();
  if (ideal && ideal !== wants) requests.push({ text: ideal, kind: "ideal" });

  const risks: DisplayRisk[] = [];
  const gapFlags: string[] = [];
  if (form.goals.prescriptionRisk) gapFlags.push("Risco de prescrição");
  if (form.goals.evidenceLossRisk) gapFlags.push("Risco de perda de prova");
  if (form.goals.immediateDamageRisk) gapFlags.push("Risco de dano imediato");
  if ((form.documents.missingNotes ?? "").trim()) {
    gapFlags.push(form.documents.missingNotes.trim());
  }
  if (meta?.informationGaps?.length) gapFlags.push(...meta.informationGaps);

  const pendingQuestions = meta?.missingQuestions ?? [];
  const insufficient =
    parties.length === 0 && facts.length === 0 && !wants && pendingQuestions.length > 0;

  return {
    source: meta ? "intake_structured" : "intake_form",
    parties,
    facts,
    requests,
    risks,
    gaps: gapFlags,
    pendingQuestions,
    nextSteps: meta?.nextSteps ?? [],
    partyRelations: meta?.partyRelations ?? [],
    evidenceMentioned: meta?.evidenceMentioned ?? [],
    needsConfirmation: meta?.needsConfirmation ?? [],
    legalArea: form.attend.probableLegalArea?.trim() || null,
    clientObjective: wants || null,
    insufficient,
  };
}

function emptyDisplayExtras(): Pick<
  CaseDisplaySnapshot,
  | "gaps"
  | "pendingQuestions"
  | "nextSteps"
  | "partyRelations"
  | "evidenceMentioned"
  | "needsConfirmation"
  | "insufficient"
> {
  return {
    gaps: [],
    pendingQuestions: [],
    nextSteps: [],
    partyRelations: [],
    evidenceMentioned: [],
    needsConfirmation: [],
    insufficient: false,
  };
}

function deriveDisplayFromSnapshot(
  snap: CaseBrainSnapshot,
  meta?: ReturnType<typeof readCaseIntakeFundamentalMeta>,
): CaseDisplaySnapshot {
  const extras = emptyDisplayExtras();
  if (meta) {
    extras.gaps = meta.informationGaps ?? [];
    extras.pendingQuestions = meta.missingQuestions ?? [];
    extras.nextSteps = meta.nextSteps ?? [];
    extras.partyRelations = meta.partyRelations ?? [];
    extras.evidenceMentioned = meta.evidenceMentioned ?? [];
    extras.needsConfirmation = meta.needsConfirmation ?? [];
  }

  const source = pickStructuredSource({ snap, intakeForm: null });
  if (source === "brain" && snap.brain) {
    const parties = snap.brain.parties.map((p) => ({ role: p.role, name: p.name }));
    const facts = snap.brain.facts.map((f) => ({ text: f.text }));
    return {
      source: "structured",
      parties,
      facts,
      requests: snap.brain.requests.map((r) => ({ text: r.text, kind: r.kind })),
      risks: snap.brain.risks.map((r) => ({
        title: r.title,
        detail: r.detail,
        severity: r.severity,
      })),
      ...extras,
      legalArea: snap.brain.area?.[0] ?? null,
      clientObjective: snap.brain.objective?.trim() || null,
      insufficient: parties.length === 0 && facts.length === 0,
    };
  }

  const parties = snap.parties.map((p) => ({ role: p.role, name: p.name }));
  const facts = snap.facts.map((f) => ({ text: f.text, category: f.category ?? undefined }));
  return {
    source: "structured",
    parties,
    facts,
    requests: snap.claims.map((r) => ({ text: r.text, kind: r.kind })),
    risks: snap.risks.map((r) => ({ title: r.title, detail: r.detail, severity: r.severity })),
    ...extras,
    legalArea: null,
    clientObjective: snap.summary,
    insufficient: parties.length === 0 && facts.length === 0,
  };
}

export function buildCaseDisplaySnapshot(args: {
  metadataJson: unknown;
  snap?: CaseBrainSnapshot | null;
}): CaseDisplaySnapshot | null {
  const intakeForm = getCaseIntakeForm(args.metadataJson);
  const structured = isFundamentalIntakeStructured(args.metadataJson);
  const intakeMeta = readCaseIntakeFundamentalMeta(args.metadataJson);

  if (structured && args.snap) {
    return deriveDisplayFromSnapshot(args.snap, intakeMeta ?? undefined);
  }
  if (intakeForm) {
    return deriveDisplayFromIntakeForm(intakeForm, intakeMeta ?? undefined);
  }
  if (args.snap) {
    return deriveDisplayFromSnapshot(args.snap, intakeMeta ?? undefined);
  }
  return null;
}

function checklistLabels(form: FundamentalIntakeForm): string[] {
  const ch = form.documents.checklist ?? {};
  const labels: Record<string, string> = {
    personalId: "Documento pessoal",
    contract: "Contrato",
    paymentProof: "Comprovante de pagamento",
    whatsappPrints: "Prints WhatsApp",
    courtOrder: "Decisão judicial",
  };
  return Object.entries(labels)
    .filter(([k]) => Boolean((ch as Record<string, boolean | undefined>)[k]))
    .map(([, v]) => v);
}

function buildPayloadForTask(
  taskType: CaseTaskType,
  form: FundamentalIntakeForm | null,
  snap: CaseBrainSnapshot | null,
  display: CaseDisplaySnapshot | null,
): Record<string, unknown> {
  const area =
    display?.legalArea ??
    form?.attend.probableLegalArea?.trim() ??
    null;
  const factsText =
    display?.facts.map((f) => f.text).join("\n") ||
    (form ? buildIntakeNarrativeForModel(form).slice(0, 4_000) : snap?.rawInput?.slice(0, 4_000)) ||
    "";
  const requestsText = display?.requests.map((r) => r.text).join("\n") || "";
  const partiesText =
    display?.parties.map((p) => `- (${p.role}) ${p.name}`).join("\n") || "";

  switch (taskType) {
    case "legal_research":
      return compactContextPayload({
        legalArea: area,
        facts: factsText,
        requests: requestsText,
        lawyerQuestions: form?.communication?.internalNotes?.trim(),
        jurisdiction: form
          ? { uf: form.attend.uf, city: form.attend.city, tribunal: form.attend.tribunalVara, cnj: form.attend.cnj }
          : undefined,
        relevantDocuments: form ? checklistLabels(form) : [],
        contextSource: pickStructuredSource({ snap, intakeForm: form }),
      });
    case "strategy":
      return compactContextPayload({
        clientObjective: display?.clientObjective ?? form?.goals.clientWants,
        facts: factsText,
        requests: requestsText,
        parties: partiesText,
        risks:
          (display?.risks.length
            ? display.risks.map((r) => `${r.title}: ${r.detail}`)
            : display?.gaps) ?? [],
        evidenceChecklist: form ? checklistLabels(form) : [],
        gaps: display?.gaps ?? [],
        urgency: form?.goals.urgency ?? false,
        lawyerQuestions: form?.communication?.internalNotes?.trim(),
        contextSource: pickStructuredSource({ snap, intakeForm: form }),
      });
    case "draft":
      return compactContextPayload({
        parties: partiesText,
        facts: factsText,
        requests: requestsText,
        pinnedFoundationsNote: "Use somente fundamentos fixados (pins) na pesquisa do caso.",
        evidenceChecklist: form ? checklistLabels(form) : [],
        gaps: display?.gaps ?? [],
        contextSource: pickStructuredSource({ snap, intakeForm: form }),
      });
    case "organize_case":
      return compactContextPayload({
        narrative: form ? buildIntakeNarrativeForModel(form) : snap?.rawInput,
      });
    case "document_analysis":
      return {};
    case "review":
      return compactContextPayload({ facts: factsText, parties: partiesText });
    default:
      return {};
  }
}

/** Serializa o payload compacto para prompts (sem JSON bruto da entrevista). */
export function formatCaseTaskContextForPrompt(ctx: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(ctx)) {
    if (key === "contextSource") continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      lines.push(`${key}:\n${value}`);
    } else if (Array.isArray(value)) {
      if (value.length) lines.push(`${key}:\n${value.map(String).join("\n")}`);
    } else if (typeof value === "object") {
      lines.push(`${key}:\n${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return lines.join("\n\n").slice(0, 12_000);
}

export async function loadCaseDisplaySnapshot(
  caseId: string,
  workspaceId: string,
): Promise<CaseDisplaySnapshot | null> {
  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { metadataJson: true },
  });
  if (!row) return null;
  const snap = await getCaseBrainSnapshot(caseId, workspaceId);
  return buildCaseDisplaySnapshot({ metadataJson: row.metadataJson, snap });
}

/**
 * Monta contexto mínimo por tarefa (pesquisa, estratégia, minuta, organizar).
 */
export async function buildCaseTaskContext(
  caseId: string,
  workspaceId: string,
  taskType: CaseTaskType,
): Promise<Record<string, unknown> | null> {
  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { metadataJson: true },
  });
  if (!row) return null;

  const intakeForm = getCaseIntakeForm(row.metadataJson);
  const snap = await getCaseBrainSnapshot(caseId, workspaceId);
  const display = buildCaseDisplaySnapshot({ metadataJson: row.metadataJson, snap });
  const payload = buildPayloadForTask(taskType, intakeForm, snap, display);

  if (taskType === "legal_research" || taskType === "draft") {
    const pins = await listPinnedFoundations(caseId, workspaceId);
    const pinSummaries = pins
      .filter((p) => p.kind === "foundation")
      .slice(0, 12)
      .map((p) => {
        const f = p as { title?: string; citation?: string };
        return `${f.title ?? "Fundamento"}: ${f.citation ?? ""}`.trim();
      });
    if (pinSummaries.length) payload["pinnedFoundations"] = pinSummaries;
  }

  return payload;
}
