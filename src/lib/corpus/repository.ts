/**
 * Persistência canônica do corpus jurídico.
 *
 *  - Idempotência forte por (URN, contentHash): mesmo payload = no-op.
 *  - Versionamento temporal: cada conteúdo novo cria um `LegalNormVersion`.
 *  - Dedup de chunks por (normVersionId, contentHash) — não duplicamos
 *    embeddings entre re-runs.
 *  - Citações são UPSERTs por (sourceNormId, targetUrn, kind), com resolução
 *    lazy do `targetNormId`.
 *
 * Não faz embeddings nem fala com Qdrant (responsabilidade do pipeline).
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CorpusProvider,
  IngestionJobStatus,
  NormJurisdiction,
  NormStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizeForHash, normalizeLegalText } from "./normalize";
import { extractCitations } from "./citations";
import { CHUNKER_VERSION, chunkLegalNorm } from "./legal-chunker-v2";
import { classifyJurisdictionFromUrn, parseUrnLex } from "./urn";
import type { CorpusPayload } from "./providers/types";

export type IngestResult = {
  normId: string;
  versionId: string;
  created: boolean;
  /** True quando criamos uma versão nova (texto mudou desde último fetch). */
  versioned: boolean;
  chunksUpserted: number;
  citationsUpserted: number;
  contentHash: string;
};

function hashRaw(text: string): string {
  return createHash("sha256")
    .update(canonicalizeForHash(text), "utf8")
    .digest("hex");
}

function chunkHash(text: string): string {
  return createHash("sha256").update(canonicalizeForHash(text), "utf8").digest("hex");
}

/**
 * Faz upsert de UMA norma no banco. Idempotente: a mesma norma + payload
 * idêntico não cria nada novo. Se o conteúdo mudou, cria nova versão e
 * regera chunks (obsoletos são removidos do banco — Qdrant é atualizado
 * pelo embeddings pipeline).
 */
export async function upsertCorpusPayload(
  payload: CorpusPayload,
  options: { provider: CorpusProvider } = { provider: CorpusProvider.LEXML },
): Promise<IngestResult> {
  const { candidate } = payload;
  const normalized = normalizeLegalText(payload.rawText);
  if (!normalized) {
    throw new Error(`Payload vazio para ${candidate.urn}`);
  }
  const contentHash = hashRaw(normalized);

  const parsedUrn = parseUrnLex(candidate.urn);
  const jurisdiction =
    candidate.kind === "JURISPRUDENCE_STF" ||
    candidate.kind === "JURISPRUDENCE_STJ" ||
    candidate.kind === "JURISPRUDENCE_TST" ||
    candidate.kind === "JURISPRUDENCE_OTHER"
      ? NormJurisdiction.COURT
      : classifyJurisdictionFromUrn(parsedUrn);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.legalNorm.findUnique({
      where: { urn: candidate.urn },
      include: { versions: { orderBy: { validFrom: "desc" }, take: 1 } },
    });

    let normId: string;
    let created = false;
    if (!existing) {
      const titleData: Prisma.LegalNormCreateInput = {
        urn: candidate.urn,
        kind: candidate.kind,
        jurisdiction,
        status: NormStatus.ACTIVE,
        title: candidate.title,
        identifier: candidate.identifier ?? null,
        authority: candidate.authority ?? null,
        tribunal: candidate.tribunal ?? null,
        rapporteur: candidate.rapporteur ?? null,
        ementa: candidate.ementa ?? null,
        publishedAt: candidate.publishedAt ?? null,
        effectiveAt: candidate.effectiveAt ?? null,
        revokedAt: candidate.revokedAt ?? null,
        language: candidate.language ?? "pt-BR",
        tags: candidate.tags ?? [],
        sourceProvider: options.provider,
        sourceUrl: candidate.sourceUrl ?? null,
        sourceExternalId: candidate.sourceExternalId ?? null,
        contentHash,
        lastFetchedAt: new Date(),
      };
      if (candidate.etag) titleData.etag = candidate.etag;
      if (candidate.lastModifiedAt) titleData.lastModifiedAt = candidate.lastModifiedAt;
      const inserted = await tx.legalNorm.create({ data: titleData });
      normId = inserted.id;
      created = true;
    } else {
      normId = existing.id;
      // Atualiza metadados (mas mantém histórico via versions).
      await tx.legalNorm.update({
        where: { id: existing.id },
        data: {
          title: candidate.title,
          identifier: candidate.identifier ?? null,
          authority: candidate.authority ?? existing.authority,
          tribunal: candidate.tribunal ?? existing.tribunal,
          rapporteur: candidate.rapporteur ?? existing.rapporteur,
          ementa: candidate.ementa ?? existing.ementa,
          publishedAt: candidate.publishedAt ?? existing.publishedAt,
          effectiveAt: candidate.effectiveAt ?? existing.effectiveAt,
          revokedAt: candidate.revokedAt ?? existing.revokedAt,
          tags: candidate.tags ?? existing.tags,
          sourceProvider: options.provider,
          sourceUrl: candidate.sourceUrl ?? existing.sourceUrl,
          sourceExternalId: candidate.sourceExternalId ?? existing.sourceExternalId,
          contentHash,
          etag: candidate.etag ?? existing.etag,
          lastModifiedAt: candidate.lastModifiedAt ?? existing.lastModifiedAt,
          lastFetchedAt: new Date(),
        },
      });
    }

    // Há versão idêntica? Idempotente: nada a fazer (mas atualizamos lastFetched).
    const idemVersion = await tx.legalNormVersion.findUnique({
      where: { normId_contentHash: { normId, contentHash } },
    });
    if (idemVersion) {
      return {
        normId,
        versionId: idemVersion.id,
        created,
        versioned: false,
        chunksUpserted: 0,
        citationsUpserted: 0,
        contentHash,
      };
    }

    const validFrom =
      candidate.effectiveAt ?? candidate.publishedAt ?? new Date();

    // Encerra a versão anterior (se houver) na data de validFrom desta nova.
    if (existing) {
      await tx.legalNormVersion.updateMany({
        where: { normId, validTo: null },
        data: { validTo: validFrom },
      });
    }

    const newVersion = await tx.legalNormVersion.create({
      data: {
        normId,
        validFrom,
        contentHash,
        rawText: normalized,
        htmlSource: payload.htmlSource ?? null,
      },
    });

    // Chunks (sempre regenerados na nova versão).
    const chunks = chunkLegalNorm(normalized);
    if (chunks.length > 0) {
      await tx.legalChunk.createMany({
        data: chunks.map((c) => ({
          normId,
          normVersionId: newVersion.id,
          ordinal: c.ordinal,
          structure: c.structure,
          fullPath: c.fullPath ?? null,
          articleRef: c.articleRef ?? null,
          paragraphRef: c.paragraphRef ?? null,
          incisoRef: c.incisoRef ?? null,
          alineaRef: c.alineaRef ?? null,
          text: c.text,
          contentHash: chunkHash(c.text),
          tokenEstimate: Math.ceil(c.text.length / 4),
          chunkerVersion: CHUNKER_VERSION,
        })),
        skipDuplicates: true,
      });
    }

    // Citações (extraídas do texto canonical).
    const cites = extractCitations(normalized);
    let citationsUpserted = 0;
    for (const c of cites) {
      // Evita auto-citações (não persiste arestas pra própria norma).
      if (c.targetUrn === candidate.urn) continue;
      const target = await tx.legalNorm.findUnique({
        where: { urn: c.targetUrn },
        select: { id: true },
      });
      const existingEdge = await tx.legalCitation.findFirst({
        where: { sourceNormId: normId, targetUrn: c.targetUrn, kind: c.kind },
      });
      if (existingEdge) {
        await tx.legalCitation.update({
          where: { id: existingEdge.id },
          data: {
            confidence: Math.max(existingEdge.confidence, c.confidence),
            ...(target ? { targetNormId: target.id } : {}),
          },
        });
      } else {
        await tx.legalCitation.create({
          data: {
            sourceNormId: normId,
            targetUrn: c.targetUrn,
            kind: c.kind,
            rawText: c.rawText,
            confidence: c.confidence,
            ...(target ? { targetNormId: target.id } : {}),
          },
        });
      }
      citationsUpserted++;
    }

    return {
      normId,
      versionId: newVersion.id,
      created,
      versioned: true,
      chunksUpserted: chunks.length,
      citationsUpserted,
      contentHash,
    };
  });
}

/**
 * Após uma norma nova ser criada, resolve `targetNormId` para citações
 * pendentes que apontam pra ela. Chamar ao final de cada `upsertCorpusPayload`.
 */
export async function resolvePendingCitationsTo(urn: string): Promise<number> {
  const target = await prisma.legalNorm.findUnique({ where: { urn }, select: { id: true } });
  if (!target) return 0;
  const result = await prisma.legalCitation.updateMany({
    where: { targetUrn: urn, targetNormId: null },
    data: { targetNormId: target.id },
  });
  return result.count;
}

/**
 * Cursor de sincronização incremental por (provider, kind). Idempotente.
 */
export async function readWatermark(
  provider: CorpusProvider,
  kind?: NormKindArg,
): Promise<string | null> {
  const where: Prisma.IngestionWatermarkWhereInput = { provider };
  if (kind !== undefined) where.kind = kind;
  const w = await prisma.ingestionWatermark.findFirst({ where });
  return w?.cursor ?? null;
}

type NormKindArg = Prisma.IngestionWatermarkCreateInput["kind"];

export async function writeWatermark(args: {
  provider: CorpusProvider;
  kind: Parameters<typeof prisma.ingestionWatermark.upsert>[0]["create"]["kind"];
  cursor: string | null;
  itemsTotal?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.ingestionWatermark.upsert({
    where: {
      provider_kind: { provider: args.provider, kind: args.kind },
    },
    update: {
      cursor: args.cursor,
      lastSyncAt: new Date(),
      ...(args.itemsTotal !== undefined ? { itemsTotal: args.itemsTotal } : {}),
      ...(args.metadata !== undefined
        ? { metadataJson: args.metadata as Prisma.InputJsonValue }
        : {}),
    },
    create: {
      provider: args.provider,
      kind: args.kind,
      cursor: args.cursor,
      lastSyncAt: new Date(),
      itemsTotal: args.itemsTotal ?? 0,
      ...(args.metadata !== undefined
        ? { metadataJson: args.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/**
 * Cria registro de auditoria do job. Use em jobs de longa duração.
 */
export async function startIngestionJob(args: {
  provider: CorpusProvider;
  kind?: Parameters<typeof prisma.ingestionJob.create>[0]["data"]["kind"];
  cursor?: string;
}): Promise<string> {
  const job = await prisma.ingestionJob.create({
    data: {
      provider: args.provider,
      kind: args.kind ?? null,
      cursor: args.cursor ?? null,
      status: IngestionJobStatus.RUNNING,
    },
  });
  return job.id;
}

export async function finishIngestionJob(
  id: string,
  patch: {
    status: IngestionJobStatus;
    itemsProcessed?: number;
    itemsCreated?: number;
    itemsUpdated?: number;
    itemsSkipped?: number;
    itemsFailed?: number;
    errorMessage?: string;
  },
): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id },
    data: {
      ...patch,
      finishedAt: new Date(),
    },
  });
}
