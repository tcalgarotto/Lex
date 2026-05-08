/**
 * Worker Inngest: ingere a Constituição Federal de 1988 a partir do
 * markdown SEMÂNTICO curado em `codigos de leis/CONSTITUICAO.md` (formato
 * `[ARTIGO:N]` + `[META]...[/META]`).
 *
 * Pipeline (steps Inngest):
 *  1. read-and-parse     — `parseConstitutionSemantic` (strict).
 *  2. upsert-canonical   — `upsertCorpusPayload` (cria LegalNorm/Version/Chunk).
 *  3. enrich-metadata    — UPDATE batch em `LegalChunk.metadataJson` com
 *                          codigo, tipo, hierarchy, tema, sourceProvider=
 *                          MANUAL_MD, sourcePath, vigencia, fullPath e
 *                          normTitle (briefing FASE 3 e 5).
 *  4. resolve-citations  — resolve citations pendentes para o URN da CF.
 *  5. embed-and-upsert   — `embedAndUpsertNormVersion` (Qdrant).
 *
 * Idempotente: re-execuções com markdown idêntico viram no-op (versionamento
 * por contentHash).
 */

import { NonRetriableError } from "inngest";
import { CorpusProvider, NormStatus, Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import {
  buildCfCorpusPayloads,
  CF_ADCT_URN,
  CF_SOURCE_PROVIDER_TAG,
  CF_URN,
  loadParsedConstitution,
} from "@/lib/corpus/providers/markdown-cf";
import type { CorpusPayload } from "@/lib/corpus/providers/types";
import {
  resolvePendingCitationsTo,
  upsertCorpusPayload,
} from "@/lib/corpus/repository";
import { embedAndUpsertNormVersion } from "@/lib/corpus/embeddings-pipeline";
import { prisma } from "@/lib/prisma";

const SOURCE_PATH = "codigos de leis/CONSTITUICAO.md";

/**
 * Para cada chunk da versão recém-criada, decora `metadataJson` com:
 *   - codigo (CF | ADCT)
 *   - tipo (CONSTITUICAO)
 *   - hierarquia (raw, ex.: "TITULO_II>...")
 *   - hierarchy (humanizado, ex.: "Título II > ...")  ← briefing
 *   - tema
 *   - vigencia
 *   - normTitle / identifier (do candidate)
 *   - sourceProvider=MANUAL_MD
 *   - sourcePath
 *   - status=ACTIVE
 *
 * Match de chunk → artigo é por `articleRef` canônico (Art. Nº | Art. N |
 * Art. N-X), produzido por `legal-chunker-v2` a partir do texto canônico.
 */
type SegmentArticleMeta = {
  number: string;
  ref: string;
  segment: "MAIN" | "ADCT";
  codigo: string;
  tipo: string;
  hierarquia: string;
  tema: string;
  vigencia: string;
  fullPath: string;
};

function articlesFromPayload(payload: CorpusPayload): SegmentArticleMeta[] {
  const meta = payload.metadata as { articles?: SegmentArticleMeta[] } | undefined;
  return meta?.articles ?? [];
}

/**
 * Decora `metadataJson` dos chunks de UMA versão (corpo principal OU
 * ADCT). Como cada segmento é uma `LegalNorm` distinta (URN diferente),
 * não há colisão de `articleRef` entre segmentos. Match é direto por
 * articleRef → metadados do artigo correspondente.
 */
async function enrichChunkMetadata(
  versionId: string,
  articlesMeta: SegmentArticleMeta[],
  normInfo: { title: string; identifier: string },
): Promise<{ updated: number; missing: number }> {
  const byRef = new Map<string, SegmentArticleMeta>();
  for (const a of articlesMeta) byRef.set(a.ref, a);

  const chunks = await prisma.legalChunk.findMany({
    where: { normVersionId: versionId },
    select: {
      id: true,
      articleRef: true,
      paragraphRef: true,
      incisoRef: true,
      alineaRef: true,
    },
  });

  let updated = 0;
  let missing = 0;
  for (const chunk of chunks) {
    const articleRef = chunk.articleRef;
    if (!articleRef) {
      missing++;
      continue;
    }
    const meta = byRef.get(articleRef);
    if (!meta) {
      missing++;
      continue;
    }
    const metadataJson: Prisma.JsonObject = {
      codigo: meta.codigo,
      tipo: meta.tipo,
      hierarquia: meta.hierarquia,
      hierarchy: meta.fullPath,
      tema: meta.tema,
      vigencia: meta.vigencia,
      segment: meta.segment,
      normTitle: normInfo.title,
      identifier: normInfo.identifier,
      sourceProvider: CF_SOURCE_PROVIDER_TAG,
      sourcePath: SOURCE_PATH,
      status: NormStatus.ACTIVE,
      ...(chunk.paragraphRef ? { paragraphRef: chunk.paragraphRef } : {}),
      ...(chunk.incisoRef ? { incisoRef: chunk.incisoRef } : {}),
      ...(chunk.alineaRef ? { alineaRef: chunk.alineaRef } : {}),
    };
    await prisma.legalChunk.update({
      where: { id: chunk.id },
      data: { metadataJson },
    });
    updated++;
  }
  return { updated, missing };
}

type SegmentResult = {
  urn: string;
  ingest: {
    normId: string;
    versionId: string;
    created: boolean;
    versioned: boolean;
    chunks: number;
    citations: number;
    contentHash: string;
  };
  enrich: { updated: number; missing: number };
  embed: { processed: number; skipped: number; errors: number } | null;
};

async function ingestSegment(
  payload: CorpusPayload,
  opts: { skipEmbed: boolean },
): Promise<SegmentResult> {
  const result = await upsertCorpusPayload(payload, {
    provider: CorpusProvider.MANUAL,
  });
  const articlesMeta = articlesFromPayload(payload);
  const enrich = await enrichChunkMetadata(result.versionId, articlesMeta, {
    title: payload.candidate.title,
    identifier: payload.candidate.identifier ?? "",
  });
  let embed: { processed: number; skipped: number; errors: number } | null = null;
  if (!opts.skipEmbed && result.versioned) {
    const r = await embedAndUpsertNormVersion({ normVersionId: result.versionId });
    embed = {
      processed: r.chunksProcessed,
      skipped: r.chunksSkipped,
      errors: r.errors,
    };
  }
  return {
    urn: payload.candidate.urn,
    ingest: {
      normId: result.normId,
      versionId: result.versionId,
      created: result.created,
      versioned: result.versioned,
      chunks: result.chunksUpserted,
      citations: result.citationsUpserted,
      contentHash: result.contentHash,
    },
    enrich,
    embed,
  };
}

export const ingestConstitution = inngest.createFunction(
  {
    id: "ingest-constitution",
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: "lex/corpus.ingest-cf" },
  async ({ event, step }) => {
    const markdownPath = (event.data?.markdownPath as string | undefined) ?? undefined;
    const skipEmbed = Boolean(event.data?.skipEmbed);

    const { mdLength, parseStats } = await step.run("read-and-parse", async () => {
      try {
        const { md, parsed } = await loadParsedConstitution(markdownPath);
        return {
          mdLength: md.length,
          parseStats: parsed.stats,
        };
      } catch (err) {
        throw new NonRetriableError((err as Error).message);
      }
    });

    const main = await step.run("ingest-main", async () => {
      const { md, parsed } = await loadParsedConstitution(markdownPath);
      const { main: mainPayload } = buildCfCorpusPayloads(parsed, md);
      return ingestSegment(mainPayload, { skipEmbed });
    });

    const adct = await step.run("ingest-adct", async () => {
      const { md, parsed } = await loadParsedConstitution(markdownPath);
      const { adct: adctPayload } = buildCfCorpusPayloads(parsed, md);
      return ingestSegment(adctPayload, { skipEmbed });
    });

    await step.run("resolve-citations", async () => {
      await resolvePendingCitationsTo(CF_URN);
      await resolvePendingCitationsTo(CF_ADCT_URN);
    });

    return {
      ok: true,
      mdLength,
      parseStats,
      main,
      adct,
    };
  },
);

/** Implementação direta (sem Inngest) — usada pelo script `corpus:ingest-cf`. */
export async function ingestConstitutionDirect(opts: {
  markdownPath?: string | undefined;
  skipEmbed?: boolean;
}): Promise<{
  main: SegmentResult;
  adct: SegmentResult;
  resolved: { main: number; adct: number };
  parseStats: { articlesMain: number; articlesAdct: number; incisos: number; paragrafos: number; alineas: number };
  mdLength: number;
}> {
  const { md, parsed } = await loadParsedConstitution(opts.markdownPath);
  const { main: mainPayload, adct: adctPayload } = buildCfCorpusPayloads(parsed, md);
  const main = await ingestSegment(mainPayload, { skipEmbed: Boolean(opts.skipEmbed) });
  const adct = await ingestSegment(adctPayload, { skipEmbed: Boolean(opts.skipEmbed) });
  const resolvedMain = await resolvePendingCitationsTo(CF_URN);
  const resolvedAdct = await resolvePendingCitationsTo(CF_ADCT_URN);
  return {
    main,
    adct,
    resolved: { main: resolvedMain, adct: resolvedAdct },
    parseStats: parsed.stats,
    mdLength: md.length,
  };
}
