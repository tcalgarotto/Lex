/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import {
  CasePartyRole,
  CaseRequestKind,
  CaseRiskKind,
  CaseRiskSeverity,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runIntake } from "@/lib/cases/intake";
import type { ParsedFact, ParsedParty, ParsedRequest, ParsedRisk } from "@/lib/cases/types";
import { computeProceduralReadiness } from "@/lib/cases/readiness";
import type { BrainFact, BrainParty, BrainRequest } from "@/lib/cases/brain-types";
import { mergeCaseMetadataJson } from "./case-metadata-merge";
import { computeCaseFingerprint } from "./fingerprint";
import { recordCaseMutationActivity } from "./activity-log";
import { normalizeTextKey, readEntityMeta } from "./merge-policy";

const ORIGIN = "entrevista_guiada" as const;
const DEFAULT_STATUS = "sugerido";

export type InterviewExtractInput = {
  /** Texto livre da resposta (ou concatenado). */
  answerText: string;
  /** id do campo do template (opcional, audit trail). */
  fieldId?: string;
};

export type InterviewExtractResult = {
  partiesCreated: number;
  factsCreated: number;
  requestsCreated: number;
  risksCreated: number;
};

function ruleLayer(text: string): {
  parties: ParsedParty[];
  facts: ParsedFact[];
  requests: ParsedRequest[];
  risks: ParsedRisk[];
} {
  const t = text.trim();
  const lc = t.toLowerCase();
  const parties: ParsedParty[] = [];
  const facts: ParsedFact[] = [];
  const requests: ParsedRequest[] = [];
  const risks: ParsedRisk[] = [];

  if (/\b(sou|sou a)\s+(mãe|mae|pai|genitora|genitor|responsável|responsavel)\b/i.test(t)) {
    parties.push({
      role: CasePartyRole.AUTHOR,
      kind: "PERSON",
      name: "Cliente (representante)",
      metadataJson: {
        origem: ORIGIN,
        status: DEFAULT_STATUS,
        sourceText: t.slice(0, 500),
        relationshipHint: "representante/genitora",
        confidence: 0.72,
      },
    });
  }

  const childM = /\b(minha|meu)\s+(filha|filho)\b/i.exec(t);
  const ageM = /\b(\d{1,2})\s*anos?\b/i.exec(t);
  if (childM || ageM) {
    parties.push({
      role: CasePartyRole.INTERVENING,
      kind: "PERSON",
      name: ageM ? `Criança (${ageM[1]} anos)` : "Criança (menor)",
      metadataJson: {
        origem: ORIGIN,
        status: DEFAULT_STATUS,
        sourceText: t.slice(0, 500),
        confidence: ageM ? 0.78 : 0.65,
      },
    });
    if (ageM) {
      facts.push({
        ordinal: 1,
        text: `Situação envolve criança de ${ageM[1]} anos.`,
        dates: [],
        confidence: 0.8,
        category: "vinculo",
      });
    }
  }

  if (/\b(prefeitura|munic[ií]pio|secretaria|autoridade)\b/i.test(t) && /\b(negou|negaram|recusou|indeferiu|não\s+consegui|nao\s+consegui)\b/i.test(t)) {
    facts.push({
      ordinal: 1,
      text: `Contato com autoridade pública e resposta negativa conforme relato: ${t.slice(0, 400)}`,
      dates: [],
      confidence: 0.74,
      category: "conduta",
    });
    parties.push({
      role: CasePartyRole.DEFENDANT,
      kind: "PUBLIC_ENTITY",
      name: "Autoridade pública (nome a confirmar)",
      metadataJson: {
        origem: ORIGIN,
        status: DEFAULT_STATUS,
        sourceText: t.slice(0, 500),
        confidence: 0.55,
        paperTermHint: true,
      },
    });
    facts.push({
      ordinal: 1,
      text: "Possível ausência de comprovantes ou documentos administrativos mencionados no relato — verificar anexos.",
      dates: [],
      confidence: 0.5,
      category: "prova",
    });
  }

  if (/\b(vaga\s+imediata|urgência|urgencia|liminar|tutela\s+antecipada)\b/i.test(lc)) {
    requests.push({
      ordinal: 1,
      kind: CaseRequestKind.URGENCY,
      text: `Pedido de tutela de urgência / providência imediata: ${t.slice(0, 400)}`,
      metadataJson: {
        origem: ORIGIN,
        status: DEFAULT_STATUS,
        sourceText: t.slice(0, 500),
        confidence: 0.7,
      },
    });
  }

  if (/\b(não\s+tenho\s+documento|nao\s+tenho\s+documento|sem\s+documento|falta\s+documento)\b/i.test(lc)) {
    risks.push({
      kind: CaseRiskKind.MISSING_GROUNDING,
      severity: CaseRiskSeverity.HIGH,
      title: "Risco probatório — documentação incompleta",
      detail: t.slice(0, 2000),
      evidenceChunkIds: [],
      evidenceNormUrns: [],
    });
  }

  return { parties, facts, requests, risks };
}

function mergeIntakeWithRules(text: string): {
  parties: ParsedParty[];
  facts: ParsedFact[];
  requests: ParsedRequest[];
  risks: ParsedRisk[];
} {
  const intake = runIntake(text);
  const rules = ruleLayer(text);
  const partyKeys = new Set(intake.parties.map((p) => `${p.role}::${normalizeTextKey(p.name)}`));
  const mergedParties = [...intake.parties];
  for (const p of rules.parties) {
    const k = `${p.role}::${normalizeTextKey(p.name)}`;
    if (!partyKeys.has(k)) {
      partyKeys.add(k);
      mergedParties.push({
        ...p,
        metadataJson: {
          origem: ORIGIN,
          status: DEFAULT_STATUS,
          sourceText: text.slice(0, 500),
          confidence: 0.65,
          ...(p.metadataJson ?? {}),
        },
      });
    }
  }
  const factTexts = new Set(intake.facts.map((f) => normalizeTextKey(f.text)));
  const mergedFacts = [...intake.facts];
  for (const f of rules.facts) {
    const key = normalizeTextKey(f.text);
    if (!factTexts.has(key)) {
      factTexts.add(key);
      mergedFacts.push(f);
    }
  }
  const reqTexts = new Set(intake.requests.map((r) => normalizeTextKey(r.text)));
  const mergedReq = [...intake.requests];
  for (const r of rules.requests) {
    const key = normalizeTextKey(r.text);
    if (!reqTexts.has(key)) {
      reqTexts.add(key);
      mergedReq.push({
        ...r,
        metadataJson: {
          origem: ORIGIN,
          status: DEFAULT_STATUS,
          sourceText: text.slice(0, 500),
          confidence: 0.68,
          ...(r.metadataJson ?? {}),
        },
      });
    }
  }
  const riskTitles = new Set(intake.risks.map((r) => normalizeTextKey(r.title)));
  const mergedRisks = [...intake.risks];
  for (const r of rules.risks) {
    const key = normalizeTextKey(r.title);
    if (!riskTitles.has(key)) {
      riskTitles.add(key);
      mergedRisks.push({
        ...r,
        // ParsedRisk has no metadataJson in types - add via cast for persist
      } as ParsedRisk);
    }
  }
  return { parties: mergedParties, facts: mergedFacts, requests: mergedReq, risks: mergedRisks };
}

function intakePartyToMeta(p: ParsedParty, sourceText: string): Prisma.InputJsonValue {
  return {
    ...(p.metadataJson ?? {}),
    origem: ORIGIN,
    status: (p.metadataJson as { status?: string } | undefined)?.status ?? DEFAULT_STATUS,
    sourceText: sourceText.slice(0, 2000),
  } as Prisma.InputJsonValue;
}

function intakeFactMeta(sourceText: string): Prisma.InputJsonValue {
  return {
    origem: ORIGIN,
    status: DEFAULT_STATUS,
    sourceText: sourceText.slice(0, 2000),
    confidence: 0.65,
  } as Prisma.InputJsonValue;
}

function intakeRequestMeta(p: ParsedRequest, sourceText: string): Prisma.InputJsonValue {
  return {
    ...(p.metadataJson ?? {}),
    origem: ORIGIN,
    status: (p.metadataJson as { status?: string } | undefined)?.status ?? DEFAULT_STATUS,
    sourceText: sourceText.slice(0, 2000),
  } as Prisma.InputJsonValue;
}

function riskMeta(sourceText: string): Prisma.InputJsonValue {
  return {
    origem: ORIGIN,
    status: DEFAULT_STATUS,
    sourceText: sourceText.slice(0, 2000),
    confidence: 0.7,
  } as Prisma.InputJsonValue;
}

/**
 * Persiste sugestões da entrevista nas tabelas relacionais, sem sobrescrever itens
 * com `lockedByUser` / status confirmado.
 */
export async function mergeInterviewExtractIntoCase(args: {
  workspaceId: string;
  caseId: string;
  userId: string | undefined;
  input: InterviewExtractInput;
}): Promise<InterviewExtractResult> {
  const { workspaceId, caseId, userId, input } = args;
  const text = input.answerText.trim();
  if (!text) {
    return { partiesCreated: 0, factsCreated: 0, requestsCreated: 0, risksCreated: 0 };
  }

  const merged = mergeIntakeWithRules(text);

  const existingParties = await prisma.caseParty.findMany({ where: { caseId } });
  const existingFacts = await prisma.caseFact.findMany({ where: { caseId } });
  const existingReq = await prisma.caseRequest.findMany({ where: { caseId } });
  const existingRisks = await prisma.caseRisk.findMany({ where: { caseId } });

  const partyKeys = new Set(
    existingParties.map((p) => `${p.role}::${normalizeTextKey(p.name)}`),
  );
  const factKeys = new Set(existingFacts.map((f) => normalizeTextKey(f.text)));
  const reqKeys = new Set(existingReq.map((r) => normalizeTextKey(r.text)));
  const riskTitles = new Set(existingRisks.map((r) => normalizeTextKey(r.title)));

  let partiesCreated = 0;
  let factsCreated = 0;
  let requestsCreated = 0;
  let risksCreated = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of merged.parties) {
      const key = `${p.role}::${normalizeTextKey(p.name)}`;
      if (partyKeys.has(key)) continue;
      await tx.caseParty.create({
        data: {
          caseId,
          role: p.role,
          kind: p.kind,
          name: p.name,
          ...(p.document ? { document: p.document } : {}),
          metadataJson: intakePartyToMeta(p, text),
        },
      });
      partyKeys.add(key);
      partiesCreated += 1;
    }

    const lastFact = await tx.caseFact.findFirst({
      where: { caseId },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    let ord = (lastFact?.ordinal ?? 0) + 1;
    for (const f of merged.facts) {
      const fk = normalizeTextKey(f.text);
      if (factKeys.has(fk)) continue;
      await tx.caseFact.create({
        data: {
          caseId,
          ordinal: ord,
          text: f.text,
          category: f.category ?? null,
          dates: f.dates ?? [],
          confidence: f.confidence ?? 0.65,
          metadataJson: intakeFactMeta(text),
        },
      });
      factKeys.add(fk);
      ord += 1;
      factsCreated += 1;
    }

    const lastReq = await tx.caseRequest.findFirst({
      where: { caseId },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    let ordR = (lastReq?.ordinal ?? 0) + 1;
    for (const r of merged.requests) {
      const rk = normalizeTextKey(r.text);
      if (reqKeys.has(rk)) continue;
      await tx.caseRequest.create({
        data: {
          caseId,
          ordinal: ordR,
          kind: r.kind,
          text: r.text,
          ...(r.legalBasisUrn ? { legalBasisUrn: r.legalBasisUrn } : {}),
          metadataJson: intakeRequestMeta(r, text),
        },
      });
      reqKeys.add(rk);
      ordR += 1;
      requestsCreated += 1;
    }

    for (const r of merged.risks) {
      const tk = normalizeTextKey(r.title);
      if (riskTitles.has(tk)) continue;
      await tx.caseRisk.create({
        data: {
          caseId,
          kind: r.kind,
          severity: r.severity,
          title: r.title,
          detail: r.detail,
          evidenceChunkIds: r.evidenceChunkIds,
          evidenceNormUrns: r.evidenceNormUrns,
          metadataJson: riskMeta(text),
        },
      });
      riskTitles.add(tk);
      risksCreated += 1;
    }

    const ctx = await tx.case.findFirst({
      where: { id: caseId, workspaceId },
      include: {
        parties: true,
        facts: true,
        requests: true,
        risks: true,
        documents: { select: { id: true, originalName: true } },
      },
    });
    if (ctx) {
      const metaFull = (ctx.metadataJson ?? {}) as Record<string, unknown>;
      const brainPrev = (metaFull["brain"] ?? {}) as Record<string, unknown>;
      const area = Array.isArray(brainPrev["area"]) ? (brainPrev["area"] as string[]) : [];
      const partiesBrain: BrainParty[] = ctx.parties.map((p) => {
        const m = readEntityMeta(p.metadataJson);
        return {
          role: "assisted_party",
          name: p.name,
          sourceText: String(m.sourceText ?? p.name).slice(0, 500),
          confidence: typeof m.confidence === "number" ? m.confidence : 0.6,
          origin: "input",
        };
      });
      const factsBrain: BrainFact[] = ctx.facts.map((f) => ({
        text: f.text,
        evidenceRefs: [],
        sourceText: f.text.slice(0, 400),
        confidence: f.confidence,
        origin: "input",
      }));
      const requestsBrain: BrainRequest[] = ctx.requests.map((r) => ({
        text: r.text,
        kind: "MAIN",
        sourceText: r.text.slice(0, 400),
        confidence: 0.65,
        origin: "input",
      }));
      const readiness = computeProceduralReadiness({
        parties: partiesBrain,
        facts: factsBrain,
        requests: requestsBrain,
        evidence: [],
        probableAuthority: undefined,
        missingDocuments: [],
        checklistResponses: undefined,
        documents: ctx.documents,
        area,
      });
      const meta = (ctx.metadataJson ?? {}) as Record<string, unknown>;
      const brain = (meta["brain"] ?? {}) as Record<string, unknown>;
      const nextBrain = {
        ...brain,
        proceduralReadiness: readiness,
        generatedAt: new Date().toISOString(),
      };
      const fp = await computeCaseFingerprint(caseId, workspaceId);
      const nextMeta = mergeCaseMetadataJson(meta, {
        brain: nextBrain,
        caseBrain: { ...(meta["caseBrain"] as object), caseFingerprint: fp },
      });
      await tx.case.update({
        where: { id: caseId },
        data: { metadataJson: nextMeta as Prisma.InputJsonValue },
      });
    }

    await tx.caseTimelineEvent.create({
      data: {
        caseId,
        kind: "NOTE",
        message: `Entrevista guiada: ${partiesCreated + factsCreated + requestsCreated + risksCreated} sugestão(ões) estruturada(s).`,
        payloadJson: {
          action: "intake.interview_extract",
          fieldId: input.fieldId ?? null,
          partiesCreated,
          factsCreated,
          requestsCreated,
          risksCreated,
        },
        ...(userId ? { userId } : {}),
      },
    });
  });

  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.intake.interview",
    title: "Resposta de entrevista convertida em sugestões estruturadas",
    meta: { caseId, fieldId: input.fieldId },
  });

  return { partiesCreated, factsCreated, requestsCreated, risksCreated };
}
