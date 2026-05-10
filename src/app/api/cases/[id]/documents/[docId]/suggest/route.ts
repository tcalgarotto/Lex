/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { CasePartyRole, CaseRequestKind, CaseRiskKind, CaseRiskSeverity, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { suggestFromDocumentText } from "@/lib/cases/case-brain/document-suggestions";
import { normalizeTextKey } from "@/lib/cases/case-brain/merge-policy";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";
import { touchCaseBrainFingerprintAfterMutation } from "@/lib/cases/case-brain/fingerprint";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, docId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const d = await prisma.document.findFirst({
    where: { id: docId, caseId, workspaceId, deletedAt: null },
    select: { extractedText: true, originalName: true },
  });
  if (!d?.extractedText?.trim()) {
    return NextResponse.json(
      { error: "Texto ainda não disponível. Aguarde a leitura do arquivo ou tente novamente." },
      { status: 409 },
    );
  }
  const payload = suggestFromDocumentText(d.originalName, d.extractedText);
  let factsCreated = 0;
  let partiesCreated = 0;
  let requestsCreated = 0;
  let risksCreated = 0;

  await prisma.$transaction(async (tx) => {
    const existingFacts = await tx.caseFact.findMany({ where: { caseId }, select: { text: true } });
    const factKeys = new Set(existingFacts.map((f) => normalizeTextKey(f.text)));
    const lastF = await tx.caseFact.findFirst({
      where: { caseId },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    let ord = (lastF?.ordinal ?? 0) + 1;
    for (const t of payload.suggestedFacts.slice(0, 8)) {
      const k = normalizeTextKey(t);
      if (factKeys.has(k)) continue;
      await tx.caseFact.create({
        data: {
          caseId,
          ordinal: ord,
          text: t,
          confidence: 0.55,
          metadataJson: {
            origem: "documento_OCR",
            status: "sugerido",
            sourceText: t.slice(0, 2000),
            documentId: docId,
          } as Prisma.InputJsonValue,
        },
      });
      factKeys.add(k);
      ord += 1;
      factsCreated += 1;
    }

    const existingP = await tx.caseParty.findMany({ where: { caseId }, select: { role: true, name: true } });
    const pKeys = new Set(existingP.map((p) => `${p.role}::${normalizeTextKey(p.name)}`));
    for (const sp of payload.suggestedParties.slice(0, 6)) {
      const role = sp.role as CasePartyRole;
      const key = `${role}::${normalizeTextKey(sp.name)}`;
      if (pKeys.has(key)) continue;
      await tx.caseParty.create({
        data: {
          caseId,
          role,
          kind: "UNKNOWN",
          name: sp.name,
          metadataJson: {
            origem: "documento_OCR",
            status: "sugerido",
            documentId: docId,
          } as Prisma.InputJsonValue,
        },
      });
      pKeys.add(key);
      partiesCreated += 1;
    }

    const existingR = await tx.caseRequest.findMany({ where: { caseId }, select: { text: true } });
    const rKeys = new Set(existingR.map((r) => normalizeTextKey(r.text)));
    const lastR = await tx.caseRequest.findFirst({
      where: { caseId },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    let ordR = (lastR?.ordinal ?? 0) + 1;
    for (const t of payload.suggestedRequests.slice(0, 6)) {
      const k = normalizeTextKey(t);
      if (rKeys.has(k)) continue;
      await tx.caseRequest.create({
        data: {
          caseId,
          ordinal: ordR,
          kind: CaseRequestKind.MAIN,
          text: t,
          metadataJson: {
            origem: "documento_OCR",
            status: "sugerido",
            documentId: docId,
          } as Prisma.InputJsonValue,
        },
      });
      rKeys.add(k);
      ordR += 1;
      requestsCreated += 1;
    }

    const existingRisk = await tx.caseRisk.findMany({ where: { caseId }, select: { title: true } });
    const riskKeys = new Set(existingRisk.map((r) => normalizeTextKey(r.title)));
    for (const t of payload.suggestedRisks.slice(0, 4)) {
      const k = normalizeTextKey(t);
      if (riskKeys.has(k)) continue;
      await tx.caseRisk.create({
        data: {
          caseId,
          kind: CaseRiskKind.OTHER,
          severity: CaseRiskSeverity.MEDIUM,
          title: t.slice(0, 300),
          detail: t,
          evidenceChunkIds: [],
          evidenceNormUrns: [],
          metadataJson: {
            origem: "documento_OCR",
            status: "sugerido",
            documentId: docId,
          } as Prisma.InputJsonValue,
        },
      });
      riskKeys.add(k);
      risksCreated += 1;
    }

    await tx.caseTimelineEvent.create({
      data: {
        caseId,
        kind: "NOTE",
        message: `Sugestões a partir do documento (${factsCreated + partiesCreated + requestsCreated + risksCreated} itens).`,
        payloadJson: { documentId: docId, action: "document.suggest" },
        ...(user?.id ? { userId: user.id } : {}),
      },
    });
  });

  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.document.suggest",
    title: "Sugestões geradas a partir de documento",
    meta: { caseId, documentId: docId },
  });

  return NextResponse.json({
    suggestions: payload,
    persisted: { factsCreated, partiesCreated, requestsCreated, risksCreated },
  });
}
