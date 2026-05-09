/**
 * F4.5 — Document × Case consistency checker (Inngest function).
 *
 * Disparado por `lex/document.consistency-check` ao final do pipeline de
 * ingestão quando o documento está vinculado a um caso.
 *
 * Pipeline:
 *  1. Carrega documento + caso (com brain via metadataJson).
 *  2. Roda `checkDocumentConsistency` (heurístico determinístico).
 *  3. Persiste:
 *     - `CaseRisk` DOCUMENT_INCONSISTENCY (uma por inconsistência).
 *     - `CaseTimelineEvent` DOCUMENT_INCONSISTENCY (resumo).
 *     - `Case.metadataJson.brain.inconsistencies` é atualizado on-the-fly
 *       (snapshot leve — versão completa é regerada pelo brain consolidator).
 */

import { NonRetriableError } from "inngest";
import { CaseRiskKind, CaseRiskSeverity, CaseTimelineKind, Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { checkDocumentConsistency, type CaseInconsistency } from "@/lib/cases/consistency";
import type { CaseBrain } from "@/lib/cases/brain-types";

export const checkDocumentConsistencyFn = inngest.createFunction(
  { id: "check-document-consistency", retries: 1 },
  { event: "lex/document.consistency-check" },
  async ({ event, step }) => {
    const { documentId, caseId } = event.data;

    const ctx = await step.run("load-doc-and-case", async () => {
      const [doc, c] = await Promise.all([
        prisma.document.findUnique({
          where: { id: documentId },
          select: {
            id: true,
            originalName: true,
            extractedText: true,
            workspaceId: true,
            caseId: true,
          },
        }),
        prisma.case.findUnique({
          where: { id: caseId },
          include: { documents: { select: { id: true, originalName: true } } },
        }),
      ]);
      if (!doc) throw new NonRetriableError("Documento não encontrado");
      if (!c) throw new NonRetriableError("Caso não encontrado");
      if (doc.caseId !== caseId) {
        throw new NonRetriableError("Documento não pertence ao caso indicado");
      }
      return { doc, c };
    });

    const { doc, c } = ctx;
    const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
    const brain = readBrain(meta);
    if (!brain) {
      // Sem brain ainda: nada para comparar; sai silenciosamente.
      return { ok: true, documentId, caseId, checked: false, reason: "brain ausente" };
    }
    if (!doc.extractedText || doc.extractedText.trim().length < 20) {
      return { ok: true, documentId, caseId, checked: false, reason: "documento sem texto extraído" };
    }

    const inconsistencies = await step.run("run-consistency", async () =>
      checkDocumentConsistency({
        brain,
        documents: [
          {
            id: doc.id,
            originalName: doc.originalName,
            text: doc.extractedText ?? "",
          },
        ],
        // Case model não tem `city`, mas brain.parties pode trazer endereço
        // estruturado no futuro. Por ora usamos `uf` como hint regional fraco.
        caseCity: c.uf ?? null,
        caseProcessNumber: c.processNumber ?? null,
      }),
    );

    if (inconsistencies.length === 0) {
      return { ok: true, documentId, caseId, checked: true, count: 0 };
    }

    await step.run("persist-risks-and-event", async () => {
      const risks: Prisma.CaseRiskCreateManyInput[] = inconsistencies.map((i) => ({
        caseId,
        kind: CaseRiskKind.DOCUMENT_INCONSISTENCY,
        severity: mapSeverity(i.severity),
        title: titleFor(i),
        detail: i.description,
        evidenceChunkIds: [],
        evidenceNormUrns: [],
        // metadata inicial em metadataJson para guarda do trecho do doc
        metadataJson: {
          documentId: i.documentId,
          documentName: i.documentName,
          kind: i.kind,
          evidence: i.evidence,
          suggestion: i.suggestion,
        } as Prisma.InputJsonValue,
      }));
      await prisma.caseRisk.createMany({ data: risks, skipDuplicates: true });

      await prisma.caseTimelineEvent.create({
        data: {
          caseId,
          kind: CaseTimelineKind.DOCUMENT_INCONSISTENCY,
          message: `${inconsistencies.length} inconsistência(s) entre o documento "${doc.originalName}" e o caso.`,
          payloadJson: {
            documentId: doc.id,
            count: inconsistencies.length,
            kinds: Array.from(new Set(inconsistencies.map((i) => i.kind))),
          } as Prisma.InputJsonValue,
        },
      });

      // Atualiza snapshot leve em brain.inconsistencies (sem rodar o LLM).
      const merged = mergeInconsistencies(brain.inconsistencies ?? [], inconsistencies);
      const newBrain = { ...brain, inconsistencies: merged };
      const newMeta = { ...meta, brain: newBrain };
      await prisma.case.update({
        where: { id: caseId },
        data: { metadataJson: newMeta as Prisma.InputJsonValue },
      });
    });

    return {
      ok: true,
      documentId,
      caseId,
      checked: true,
      count: inconsistencies.length,
      kinds: Array.from(new Set(inconsistencies.map((i) => i.kind))),
    };
  },
);

/* ------------------------------ helpers --------------------------------- */

function readBrain(meta: Record<string, unknown>): CaseBrain | null {
  const b = meta["brain"];
  if (!b || typeof b !== "object") return null;
  const x = b as Partial<CaseBrain>;
  if (typeof x.title !== "string") return null;
  return x as CaseBrain;
}

function mapSeverity(s: CaseInconsistency["severity"]): CaseRiskSeverity {
  switch (s) {
    case "CRITICAL":
      return CaseRiskSeverity.CRITICAL;
    case "HIGH":
      return CaseRiskSeverity.HIGH;
    case "MEDIUM":
      return CaseRiskSeverity.MEDIUM;
    case "LOW":
    default:
      return CaseRiskSeverity.LOW;
  }
}

function titleFor(i: CaseInconsistency): string {
  switch (i.kind) {
    case "name_mismatch":
    case "name_typo":
      return `Nome divergente em ${i.documentName}`;
    case "cpf_mismatch":
      return `CPF divergente em ${i.documentName}`;
    case "cnpj_mismatch":
      return `CNPJ divergente em ${i.documentName}`;
    case "process_number_mismatch":
      return `Nº CNJ divergente em ${i.documentName}`;
    case "age_mismatch":
      return `Idade divergente em ${i.documentName}`;
    case "date_mismatch":
      return `Data divergente em ${i.documentName}`;
    case "city_mismatch":
      return `Cidade divergente em ${i.documentName}`;
    default:
      return `Inconsistência em ${i.documentName}`;
  }
}

function mergeInconsistencies(
  existing: Array<{ kind: string; description: string; evidence: string }>,
  fresh: CaseInconsistency[],
): Array<{ kind: string; description: string; evidence: string }> {
  const seen = new Set(existing.map((e) => `${e.kind}|${e.description}`));
  const merged = [...existing];
  for (const f of fresh) {
    const k = `${f.kind}|${f.description}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push({ kind: f.kind, description: f.description, evidence: f.evidence });
  }
  return merged;
}
