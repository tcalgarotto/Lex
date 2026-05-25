import { createHash } from "node:crypto";
import {
  CasePartyKind,
  CasePartyRole,
  CaseRequestKind,
  CaseRiskKind,
  CaseRiskSeverity,
  CaseStatus,
  CaseTimelineKind,
  Prisma,
} from "@prisma/client";
import { onlyDigits } from "./br-validators";
import { formatCnj, stripCnj } from "@/lib/cnj";
import type { CaseBrain, BrainEvidence, BrainFact, BrainParty, BrainRequest, BrainRisk } from "@/lib/cases/brain-types";
import { computeProceduralReadiness } from "@/lib/cases/readiness";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";
import { computeCaseFingerprint } from "@/lib/cases/case-brain/fingerprint";
import { prisma } from "@/lib/prisma";
import { buildIntakeNarrativeForModel } from "./build-narrative";
import type { FundamentalIntakeForm } from "./form-schema";
import { normalizeIntakeFormPlaceholders } from "./intake-placeholder-guard";
import { mergeInformationGaps, sanitizeStructuredSummary } from "./structure-quality";
import type { DeepseekStructureResponse } from "./structured-output-schema";

function roleToBrainPartyRole(
  role: (typeof CasePartyRole)[keyof typeof CasePartyRole],
): BrainParty["role"] {
  switch (role) {
    case CasePartyRole.AUTHOR:
      return "assisted_party";
    case CasePartyRole.DEFENDANT:
      return "opposing_party";
    case CasePartyRole.INTERVENING:
      return "third_party";
    default:
      return "other";
  }
}

function prismaRoleFromAi(r: string): CasePartyRole {
  switch (r) {
    case "AUTHOR":
      return CasePartyRole.AUTHOR;
    case "DEFENDANT":
      return CasePartyRole.DEFENDANT;
    case "INTERVENING":
      return CasePartyRole.INTERVENING;
    default:
      return CasePartyRole.OTHER;
  }
}

function prismaKindFromAi(k: string | undefined): CasePartyKind {
  switch (k) {
    case "COMPANY":
      return CasePartyKind.COMPANY;
    case "PUBLIC_ENTITY":
      return CasePartyKind.PUBLIC_ENTITY;
    case "PERSON":
      return CasePartyKind.PERSON;
    default:
      return CasePartyKind.UNKNOWN;
  }
}

function prismaRequestKindFromAi(k: string | undefined): CaseRequestKind {
  switch (k) {
    case "SUBSIDIARY":
      return CaseRequestKind.SUBSIDIARY;
    case "URGENCY":
      return CaseRequestKind.URGENCY;
    case "PROVISIONAL":
      return CaseRequestKind.PROVISIONAL;
    case "EVIDENCE":
      return CaseRequestKind.EVIDENCE;
    case "PROCEDURAL":
      return CaseRequestKind.PROCEDURAL;
    case "OTHER":
      return CaseRequestKind.OTHER;
    default:
      return CaseRequestKind.MAIN;
  }
}

function prismaRiskKindFromAi(k: string | undefined): CaseRiskKind {
  switch (k) {
    case "REVOKED_NORM":
      return CaseRiskKind.REVOKED_NORM;
    case "PRECEDENT_DIVERGENCE":
      return CaseRiskKind.PRECEDENT_DIVERGENCE;
    case "HISTORIC_VERSION":
      return CaseRiskKind.HISTORIC_VERSION;
    case "MISSING_GROUNDING":
      return CaseRiskKind.MISSING_GROUNDING;
    case "WEAK_ARGUMENT":
      return CaseRiskKind.WEAK_ARGUMENT;
    case "PROCEDURAL_GAP":
      return CaseRiskKind.PROCEDURAL_GAP;
    case "DOCUMENT_INCONSISTENCY":
      return CaseRiskKind.DOCUMENT_INCONSISTENCY;
    default:
      return CaseRiskKind.OTHER;
  }
}

function prismaRiskSeverityFromAi(s: string | undefined): CaseRiskSeverity {
  switch (s) {
    case "LOW":
      return CaseRiskSeverity.LOW;
    case "HIGH":
      return CaseRiskSeverity.HIGH;
    case "CRITICAL":
      return CaseRiskSeverity.CRITICAL;
    default:
      return CaseRiskSeverity.MEDIUM;
  }
}

function buildChecklistEvidence(form: FundamentalIntakeForm): BrainEvidence[] {
  const ch = form.documents.checklist ?? {};
  const pairs: [keyof typeof ch, string][] = [
    ["personalId", "Documento pessoal (cliente)"],
    ["addressProof", "Comprovante de endereço"],
    ["contract", "Contrato"],
    ["paymentProof", "Comprovante de pagamento"],
    ["whatsappPrints", "Prints de conversas (ex.: WhatsApp)"],
    ["emails", "E-mails"],
    ["protocols", "Protocolos"],
    ["photos", "Fotos"],
    ["videos", "Vídeos"],
    ["audios", "Áudios"],
    ["policeReport", "Boletim de ocorrência"],
    ["medicalReport", "Laudo médico"],
    ["schoolProof", "Comprovante escolar"],
    ["processNumber", "Número de processo"],
    ["courtOrder", "Decisão, intimação ou despacho"],
    ["other", "Outros documentos"],
  ];
  const out: BrainEvidence[] = [];
  for (const [key, label] of pairs) {
    if (ch[key]) {
      out.push({
        kind: "document",
        ref: label,
        sourceText: `Marcado no checklist: ${label}`,
        confidence: 0.85,
        origin: "checklist",
      });
    }
  }
  return out;
}

function formDefendantsFromIntake(form: FundamentalIntakeForm): DeepseekStructureResponse["parties"] {
  if (form.opposing.unknown) return [];
  return (form.opposing.parties ?? [])
    .filter((p) => (p.name ?? "").trim().length > 1)
    .map((p) => {
      const digits = onlyDigits(p.document ?? "");
      const kind: "PERSON" | "COMPANY" =
        digits.length === 14 ? "COMPANY" : digits.length === 11 ? "PERSON" : "PERSON";
      return {
        role: "DEFENDANT" as const,
        kind,
        name: (p.name ?? "").trim(),
        document: (p.document ?? "").trim() || null,
        confidence: 0.95,
        sourceText: "Parte contrária informada no formulário de entrevista fundamental.",
      };
    });
}

/** Mescla saída do modelo com dados do formulário: autor e réus declarados no form têm prioridade. */
export function mergeStructureWithForm(
  form: FundamentalIntakeForm,
  ai: DeepseekStructureResponse,
): DeepseekStructureResponse {
  const clientName =
    form.clientKind === "PERSON"
      ? (form.clientPerson?.fullName ?? "").trim()
      : (form.clientCompany?.legalName ?? "").trim();
  const clientDocRaw =
    form.clientKind === "PERSON" ? (form.clientPerson?.cpf ?? "") : (form.clientCompany?.cnpj ?? "");
  const clientDoc = clientDocRaw.replace(/\D/g, "") ? clientDocRaw.trim() : null;

  const authorFromForm = {
    role: "AUTHOR" as const,
    kind: (form.clientKind === "COMPANY" ? "COMPANY" : "PERSON") as "COMPANY" | "PERSON",
    name: clientName,
    document: clientDoc,
    confidence: 1,
    sourceText: "Dados informados pelo advogado no formulário de entrevista fundamental.",
  };

  const fromFormDef = formDefendantsFromIntake(form);
  const seen = new Set<string>([`AUTHOR::${clientName.toLowerCase()}`]);
  const mergedParties: DeepseekStructureResponse["parties"] = [authorFromForm];
  for (const d of fromFormDef) {
    const k = `DEFENDANT::${d.name.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    mergedParties.push(d);
  }
  for (const p of ai.parties) {
    if (p.role === "AUTHOR") continue;
    const k = `${p.role}::${p.name.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    mergedParties.push(p);
  }

  const outFacts = [...ai.facts];
  for (const row of form.timeline ?? []) {
    const t = (row.event ?? "").trim();
    if (t.length < 4) continue;
    const dateLabel = row.dateUncertain
      ? (row.dateApproximate ?? "").trim() || "data aproximada"
      : row.date;
    outFacts.push({
      text: [dateLabel && `Em ${dateLabel}:`, t, row.who && `Quem: ${row.who}`, row.note && `Obs.: ${row.note}`]
        .filter(Boolean)
        .join(" "),
      dates: row.date ? [row.date] : [],
      confidence: 0.75,
      sourceText: "Linha do tempo preenchida no formulário.",
    });
  }

  const outRisks = [...ai.risks];
  if (form.opposing.unknown) {
    outRisks.push({
      title: "Parte contrária não identificada",
      detail:
        "O advogado indicou que ainda não sabe nome/dados da parte contrária. Trate como lacuna até complementar o cadastro.",
      severity: "MEDIUM",
      kind: "PROCEDURAL_GAP",
      confidence: 0.95,
      sourceText: "Campo do formulário: parte contrária desconhecida.",
    });
  }

  const missingDocs = [
    ...ai.missing_documents,
    ...(form.documents.missingNotes ?? "").trim()
      ? [(form.documents.missingNotes ?? "").trim()]
      : [],
  ];

  const narrativeForSummary = buildIntakeNarrativeForModel(form);
  const fallbackSummary = [
    clientName ? `Demanda de ${clientName}.` : "",
    outFacts.length ? `${outFacts.length} fato(s) estruturado(s).` : "",
    form.attend.preOrProcess === "pre_processual"
      ? "Caso pré-processual (sem CNJ obrigatório)."
      : "Processo judicial indicado na entrevista.",
  ]
    .filter(Boolean)
    .join(" ");

  const summary = sanitizeStructuredSummary(
    ai.case_summary.trim(),
    narrativeForSummary,
    fallbackSummary || "Caso em estruturação a partir da entrevista.",
  );

  const infoGaps = mergeInformationGaps(ai);

  return {
    ...ai,
    parties: mergedParties,
    facts: outFacts,
    risks: outRisks,
    missing_documents: Array.from(new Set(missingDocs.map((s) => s.trim()).filter(Boolean))).slice(0, 40),
    information_gaps: infoGaps,
    case_summary: summary,
  };
}

/** Campos do caso preenchidos de forma determinística a partir do formulário (sem IA). */
export function buildDeterministicCaseFieldsFromIntake(form: FundamentalIntakeForm): {
  narrative: string;
  summary: string | null;
  uf: string | null;
  processNumber: string | null;
  metaPatch: Record<string, unknown>;
} {
  const narrative = buildIntakeNarrativeForModel(form);
  const area = form.attend.probableLegalArea.trim();
  const relato =
    form.narrative.whatHappened?.trim() ||
    form.narrative.freeText?.trim() ||
    form.goals.clientWants?.trim() ||
    "";
  let summary = [area, relato.slice(0, 200)].filter(Boolean).join(" — ").trim();
  if (!summary) summary = form.attend.suggestedTitle.trim();
  if (summary.length > 280) summary = `${summary.slice(0, 277)}…`;

  let processNumber: string | null = null;
  if (form.attend.preOrProcess === "existing_process") {
    const cnjDigits = stripCnj(form.attend.cnj ?? "");
    if (cnjDigits.length === 20) processNumber = formatCnj(form.attend.cnj);
  }

  const metaPatch: Record<string, unknown> = {
    intakeForm: form,
    intakeFormSavedAt: new Date().toISOString(),
    intakeFormSource: "intake_form",
  };
  if (area) metaPatch["intakeLegalArea"] = area;
  const vara = form.attend.tribunalVara.trim();
  if (vara) metaPatch["intakeTribunalVara"] = vara;

  return {
    narrative,
    summary: summary || null,
    uf: form.attend.uf.trim().length === 2 ? form.attend.uf : null,
    processNumber,
    metaPatch,
  };
}

export async function persistFundamentalDraft(args: {
  workspaceId: string;
  userId: string;
  caseId?: string | null;
  form: FundamentalIntakeForm;
}): Promise<{ id: string }> {
  const form = normalizeIntakeFormPlaceholders(args.form);
  const { narrative, summary, uf, processNumber, metaPatch } =
    buildDeterministicCaseFieldsFromIntake(form);

  const caseData = {
    title: form.attend.suggestedTitle.trim() || "Caso em elaboração",
    rawInput: narrative,
    summary,
    uf,
    processNumber,
    metadataJson: { ...metaPatch, intakeForm: form } as Prisma.InputJsonValue,
    status: CaseStatus.INTAKE,
  };

  if (args.caseId) {
    const existing = await prisma.case.findFirst({
      where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
      select: { id: true, metadataJson: true },
    });
    if (!existing) {
      const err = new Error("Caso não encontrado.");
      (err as { status?: number }).status = 404;
      throw err;
    }
    const meta = mergeCaseMetadataJson(existing.metadataJson as Record<string, unknown>, metaPatch);
    await prisma.case.update({
      where: { id: args.caseId },
      data: {
        ...caseData,
        metadataJson: meta as Prisma.InputJsonValue,
      },
    });
    await prisma.caseTimelineEvent.create({
      data: {
        caseId: args.caseId,
        kind: CaseTimelineKind.NOTE,
        message: "Entrevista salva.",
        userId: args.userId,
        payloadJson: { source: "intake_form" },
      },
    });
    return { id: args.caseId };
  }

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.case.create({
      data: {
        workspaceId: args.workspaceId,
        createdById: args.userId,
        ...caseData,
      },
    });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: c.id,
        kind: CaseTimelineKind.CASE_CREATED,
        message: "Caso criado a partir da entrevista fundamental.",
        userId: args.userId,
      },
    });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: c.id,
        kind: CaseTimelineKind.NOTE,
        message: "Entrevista salva. A organização automática com JustOS AI é opcional.",
        userId: args.userId,
        payloadJson: { source: "intake_form" },
      },
    });
    return c;
  });

  return { id: created.id };
}

export async function applyFundamentalStructure(args: {
  workspaceId: string;
  userId: string;
  caseId: string;
  form: FundamentalIntakeForm;
  structured: DeepseekStructureResponse;
}): Promise<void> {
  const form = normalizeIntakeFormPlaceholders(args.form);
  const merged = mergeStructureWithForm(form, args.structured);
  const narrative = buildIntakeNarrativeForModel(form);
  const cnjDigits = stripCnj(form.attend.cnj);
  const processNumberFinal = cnjDigits.length === 20 ? formatCnj(form.attend.cnj) : null;

  const brainParties: BrainParty[] = merged.parties.map((p) => ({
    role: roleToBrainPartyRole(prismaRoleFromAi(p.role)),
    name: p.name,
    document: p.document ?? undefined,
    sourceText: (p.sourceText ?? p.name).slice(0, 500),
    confidence: typeof p.confidence === "number" ? p.confidence : 0.65,
    origin: "input",
  }));

  const brainFacts: BrainFact[] = merged.facts.map((f) => ({
    text: f.text,
    evidenceRefs: [],
    date: f.dates?.[0],
    sourceText: (f.sourceText ?? f.text).slice(0, 500),
    confidence: typeof f.confidence === "number" ? f.confidence : 0.6,
    origin: "input",
  }));

  const brainRequests: BrainRequest[] = merged.requests.map((r) => {
    let kind: BrainRequest["kind"] = "MAIN";
    switch (r.kind) {
      case "URGENCY":
        kind = "URGENCY";
        break;
      case "PROVISIONAL":
        kind = "PROVISIONAL";
        break;
      case "EVIDENCE":
        kind = "EVIDENCE";
        break;
      case "PROCEDURAL":
        kind = "PROCEDURAL";
        break;
      case "SUBSIDIARY":
        kind = "SUBSIDIARY";
        break;
      case "OTHER":
        kind = "OTHER";
        break;
      default:
        kind = "MAIN";
    }
    return {
      text: r.text,
      kind,
      sourceText: (r.sourceText ?? r.text).slice(0, 400),
      confidence: typeof r.confidence === "number" ? r.confidence : 0.6,
      origin: "input" as const,
    };
  });

  const brainRisks: BrainRisk[] = merged.risks.map((r) => ({
    title: r.title,
    detail: r.detail,
    severity: (r.severity ?? "MEDIUM") as BrainRisk["severity"],
    sourceText: (r.sourceText ?? r.detail).slice(0, 400),
    confidence: typeof r.confidence === "number" ? r.confidence : 0.65,
    origin: "input",
  }));

  const evidence = buildChecklistEvidence(form);

  const area = [
    merged.legal_area_suggestion?.trim(),
    form.attend.probableLegalArea?.trim(),
  ].filter((s): s is string => !!s && s.length > 0);
  const dedupedArea = Array.from(new Set(area.map((a) => a.trim()))).slice(0, 8);

  const missingDocuments = merged.missing_documents;

  const readiness = computeProceduralReadiness({
    parties: brainParties,
    facts: brainFacts,
    requests: brainRequests,
    evidence,
    probableAuthority: undefined,
    missingDocuments,
    checklistResponses: undefined,
    documents: [],
    area: dedupedArea,
  });

  const inputHash = createHash("sha256").update(narrative).update(JSON.stringify(merged)).digest("hex").slice(0, 40);

  const existingCase = await prisma.case.findFirst({
    where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
    select: { metadataJson: true },
  });
  if (!existingCase) {
    const err = new Error("Caso não encontrado.");
    (err as { status?: number }).status = 404;
    throw err;
  }
  const prevMeta = (existingCase.metadataJson ?? {}) as Record<string, unknown>;
  const prevBrain = (prevMeta["brain"] ?? {}) as Partial<CaseBrain>;
  const nextVersion = (typeof prevBrain.brainVersion === "number" ? prevBrain.brainVersion : 0) + 1;

  const brain: CaseBrain = {
    brainVersion: nextVersion,
    inputHash,
    degraded: false,
    title: form.attend.suggestedTitle.trim() || "Caso em elaboração",
    area: dedupedArea.length ? dedupedArea : ["A classificar"],
    phase: form.attend.preOrProcess === "existing_process" ? "judicial" : "pre_processual",
    problem: merged.case_summary.slice(0, 400) || "Caso em estruturação a partir da entrevista fundamental.",
    objective: (form.goals.clientWants ?? "").trim() || "A definir com o cliente.",
    thesis: "Tese a consolidar após provas e fundamentos.",
    probableMeasure: { kind: "OUTRO", rationale: "Medida provável a refinar após análise." },
    narrative: merged.case_summary || narrative.slice(0, 4000),
    parties: brainParties,
    facts: brainFacts,
    requests: brainRequests,
    risks: brainRisks,
    evidence,
    missingDocuments,
    suggestedFoundations: [],
    inconsistencies: [],
    proceduralReadiness: readiness,
    generatedAt: new Date().toISOString(),
    ...(prevBrain.checklistResponses
      ? { checklistResponses: prevBrain.checklistResponses }
      : {}),
  };

  await prisma.$transaction(async (tx) => {
    const caseRow = await tx.case.findFirst({
      where: { id: args.caseId, workspaceId: args.workspaceId },
      select: {
        id: true,
        metadataJson: true,
        facts: { select: { ordinal: true } },
        requests: { select: { ordinal: true } },
      },
    });
    if (!caseRow) {
      const err = new Error("Caso não encontrado.");
      (err as { status?: number }).status = 404;
      throw err;
    }

    const maxFactOrd =
      caseRow.facts.length === 0 ? 0 : Math.max(...caseRow.facts.map((f) => f.ordinal));
    const maxReqOrd =
      caseRow.requests.length === 0 ? 0 : Math.max(...caseRow.requests.map((r) => r.ordinal));

    await tx.case.update({
      where: { id: args.caseId },
      data: {
        title: form.attend.suggestedTitle.trim() || "Caso em elaboração",
        summary: merged.case_summary.slice(0, 2000) || null,
        rawInput: narrative,
        status: CaseStatus.RESEARCH,
        ...(processNumberFinal ? { processNumber: processNumberFinal } : {}),
      },
    });

    const partyRows = merged.parties.map((p) => ({
      caseId: args.caseId,
      role: prismaRoleFromAi(p.role),
      kind: prismaKindFromAi(p.kind),
      name: p.name.slice(0, 500),
      ...(p.document ? { document: String(p.document).slice(0, 40) } : {}),
      metadataJson: {
        source: p.role === "AUTHOR" ? "intake_form" : "deepseek_structuring",
        origem: p.role === "AUTHOR" ? "usuario" : "ia",
        sourceText: (p.sourceText ?? p.name).slice(0, 600),
        confidence: typeof p.confidence === "number" ? p.confidence : 0.65,
        status: p.role === "AUTHOR" ? "confirmado" : "sugerido",
        ...(p.role === "AUTHOR" ? { lockedByUser: true } : {}),
      } as Prisma.InputJsonValue,
    }));

    const existingParties = await tx.caseParty.findMany({
      where: { caseId: args.caseId },
      select: { role: true, name: true },
    });
    const partyKeys = new Set(existingParties.map((e) => `${e.role}::${e.name.toLowerCase()}`));
    const partiesToCreate = partyRows.filter((p) => !partyKeys.has(`${p.role}::${p.name.toLowerCase()}`));
    if (partiesToCreate.length) {
      await tx.caseParty.createMany({ data: partiesToCreate });
    }

    const factRows = merged.facts.map((f, i) => ({
      caseId: args.caseId,
      ordinal: maxFactOrd + i + 1,
      text: f.text.slice(0, 8000),
      confidence: typeof f.confidence === "number" ? f.confidence : 0.6,
      dates: (f.dates ?? []).map((d) => d.slice(0, 40)),
      ...(f.category ? { category: f.category.slice(0, 120) } : {}),
      metadataJson: {
        source: "deepseek_structuring",
        origem: "ia",
        sourceText: (f.sourceText ?? f.text).slice(0, 800),
        confidence: typeof f.confidence === "number" ? f.confidence : 0.6,
        status: "sugerido",
      } as Prisma.InputJsonValue,
    }));
    if (factRows.length) {
      await tx.caseFact.createMany({ data: factRows });
    }

    const reqRows = merged.requests.map((r, i) => ({
      caseId: args.caseId,
      ordinal: maxReqOrd + i + 1,
      kind: prismaRequestKindFromAi(r.kind),
      text: r.text.slice(0, 8000),
      metadataJson: {
        source: "deepseek_structuring",
        origem: "ia",
        sourceText: (r.sourceText ?? r.text).slice(0, 600),
        confidence: typeof r.confidence === "number" ? r.confidence : 0.6,
        status: "sugerido",
      } as Prisma.InputJsonValue,
    }));
    if (reqRows.length) {
      await tx.caseRequest.createMany({ data: reqRows });
    }

    const existingRisks = await tx.caseRisk.findMany({
      where: { caseId: args.caseId },
      select: { title: true },
    });
    const riskTitles = new Set(existingRisks.map((r) => r.title.toLowerCase()));
    const riskRows = merged.risks
      .filter((r) => !riskTitles.has(r.title.toLowerCase()))
      .map(
        (r) =>
          ({
            caseId: args.caseId,
            kind: prismaRiskKindFromAi(r.kind),
            severity: prismaRiskSeverityFromAi(r.severity),
            title: r.title.slice(0, 200),
            detail: r.detail.slice(0, 4000),
            evidenceChunkIds: [],
            evidenceNormUrns: [],
            metadataJson: {
              source: "deepseek_structuring",
              origem: "ia",
              sourceText: (r.sourceText ?? r.detail).slice(0, 600),
              confidence: typeof r.confidence === "number" ? r.confidence : 0.65,
              status: "sugerido",
            } as Prisma.InputJsonValue,
          }) satisfies Prisma.CaseRiskCreateManyInput,
      );
    if (riskRows.length) {
      await tx.caseRisk.createMany({ data: riskRows });
    }

    const timelinePayloads = merged.timeline
      .filter((t) => (t.event ?? "").trim().length > 2)
      .slice(0, 35)
      .map((t) => ({
        caseId: args.caseId,
        kind: CaseTimelineKind.NOTE,
        message: [t.date && `${t.date}:`, t.event, t.who && `(${t.who})`].filter(Boolean).join(" "),
        userId: args.userId,
        payloadJson: {
          source: "deepseek_structuring",
          documentRef: t.documentRef ?? null,
          note: t.note ?? null,
        } as Prisma.InputJsonValue,
      }));
    if (timelinePayloads.length) {
      await tx.caseTimelineEvent.createMany({ data: timelinePayloads });
    }

    const ids = form.documents.documentIds ?? [];
    if (ids.length) {
      await tx.document.updateMany({
        where: {
          id: { in: ids },
          workspaceId: args.workspaceId,
          caseId: null,
          deletedAt: null,
        },
        data: { caseId: args.caseId },
      });
    }

    const meta = mergeCaseMetadataJson(caseRow.metadataJson as Record<string, unknown>, {
      intakeForm: form,
      intakeStructuredAt: new Date().toISOString(),
      intakeStructureSource: "deepseek_structuring",
      brain,
      brainVersion: nextVersion,
      intakeFundamental: {
        nextSteps: merged.next_steps.slice(0, 16),
        missingQuestions: merged.missing_questions.slice(0, 24),
        informationGaps: mergeInformationGaps(merged).slice(0, 24),
        partyRelations: (merged.party_relations ?? []).slice(0, 12),
        evidenceMentioned: (merged.evidence_mentioned ?? []).slice(0, 20),
        needsConfirmation: (merged.needs_confirmation ?? []).slice(0, 20),
        urgencyScore: merged.urgency_score ?? null,
        readinessScore: merged.readiness_score ?? readiness.score,
      },
    });

    await tx.case.update({
      where: { id: args.caseId },
      data: { metadataJson: meta as Prisma.InputJsonValue },
    });

    await tx.caseTimelineEvent.create({
      data: {
        caseId: args.caseId,
        kind: CaseTimelineKind.INTAKE_COMPLETED,
        message: `Entrevista fundamental estruturada: ${merged.parties.length} partes · ${merged.facts.length} fatos · ${merged.requests.length} pedidos · ${merged.risks.length} riscos`,
        userId: args.userId,
        payloadJson: { source: "deepseek_structuring" },
      },
    });
  });

  const fp = await computeCaseFingerprint(args.caseId, args.workspaceId);
  const c2 = await prisma.case.findFirst({
    where: { id: args.caseId, workspaceId: args.workspaceId },
    select: { metadataJson: true },
  });
  if (c2 && fp) {
    const meta2 = mergeCaseMetadataJson(c2.metadataJson as Record<string, unknown>, {
      caseBrain: { ...((c2.metadataJson as Record<string, unknown>)["caseBrain"] as object), caseFingerprint: fp },
    });
    await prisma.case.update({
      where: { id: args.caseId },
      data: { metadataJson: meta2 as Prisma.InputJsonValue },
    });
  }
}
