/**
 * Provider PLANALTO — fonte oficial de legislação federal.
 *
 * Princípio: **NÃO faz scraping aberto**. Baixa apenas URLs explicitamente
 * declaradas no catálogo `official-laws/catalog.ts`. Isso garante:
 *   - rate limit respeitado (uma URL por lei do catálogo, max 15/sync)
 *   - texto auditável (cada chunk tem `sourceUrl`)
 *   - sem dependência de discovery via crawl
 *
 * Cabeçalhos enviados:
 *   - User-Agent: LexLegalResearchBot/<v> (+contact)
 *   - Accept: text/html
 *   - If-None-Match / If-Modified-Since (quando watermark disponível)
 *
 * Encoding: páginas do Planalto são servidas em UTF-16 LE com BOM (caso
 * típico em 2024+) ou ISO-8859-1 (páginas antigas). `decodePlanaltoBuffer`
 * detecta automaticamente.
 */

import {
  CorpusProvider,
  NormKind,
} from "@prisma/client";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";
import {
  decodePlanaltoBuffer,
  parsePlanaltoLawHtml,
  type ParsedLaw,
} from "./planalto-parser";
import { OFFICIAL_LAWS, type OfficialLaw } from "../official-laws/catalog";

export const PLANALTO_USER_AGENT =
  "LexLegalResearchBot/0.1 (+contact: lex@example.com)";

export class PlanaltoError extends Error {
  override readonly cause?: unknown;
  readonly httpStatus?: number;
  constructor(message: string, cause?: unknown, httpStatus?: number) {
    super(message);
    this.name = "PlanaltoError";
    if (cause !== undefined) this.cause = cause;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}

export type PlanaltoFetchOptions = {
  /** Timeout em ms. Default 30s. */
  timeoutMs?: number;
  /** Tentativas em caso de 5xx/timeout. Default 3. */
  retries?: number;
  /** Backoff inicial em ms. Cresce exponencial. Default 800ms. */
  baseBackoffMs?: number;
  /** ETag/If-Modified-Since vindos da última sync. */
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  /** User agent customizado (default usa `PLANALTO_USER_AGENT`). */
  userAgent?: string;
};

export type PlanaltoFetchResult = {
  status: number;
  /** True quando 304. Caller deve usar payload em cache. */
  notModified: boolean;
  html?: string;
  etag?: string;
  lastModified?: string;
  bytes?: number;
};

/**
 * Baixa uma página do Planalto com timeout/retry e decodifica o HTML
 * conforme encoding detectado. Lança `PlanaltoError` em falhas finais.
 */
export async function fetchPlanaltoLaw(
  url: string,
  opts: PlanaltoFetchOptions = {},
): Promise<PlanaltoFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 3;
  const baseBackoff = opts.baseBackoffMs ?? 800;
  const userAgent = opts.userAgent ?? PLANALTO_USER_AGENT;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        Accept: "text/html, */*;q=0.5",
        "Accept-Charset": "utf-8, utf-16, iso-8859-1;q=0.5",
      };
      if (opts.ifNoneMatch) headers["If-None-Match"] = opts.ifNoneMatch;
      if (opts.ifModifiedSince) headers["If-Modified-Since"] = opts.ifModifiedSince;

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timer);

      if (res.status === 304) {
        return {
          status: 304,
          notModified: true,
          etag: res.headers.get("etag") ?? undefined,
          lastModified: res.headers.get("last-modified") ?? undefined,
        };
      }
      if (!res.ok) {
        // 5xx → retry; 4xx → desistir (provavelmente URL errada).
        if (res.status >= 500 && attempt < retries - 1) {
          await sleep(baseBackoff * 2 ** attempt);
          continue;
        }
        throw new PlanaltoError(
          `HTTP ${res.status} ao baixar ${url}`,
          undefined,
          res.status,
        );
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      const html = decodePlanaltoBuffer(buf);
      return {
        status: res.status,
        notModified: false,
        html,
        etag: res.headers.get("etag") ?? undefined,
        lastModified: res.headers.get("last-modified") ?? undefined,
        bytes: buf.byteLength,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"));
      if (attempt < retries - 1) {
        await sleep(baseBackoff * 2 ** attempt);
        continue;
      }
      if (isAbort) {
        throw new PlanaltoError(`Timeout (${timeoutMs}ms) ao baixar ${url}`, err);
      }
      throw new PlanaltoError(`Falha ao baixar ${url}`, err);
    }
  }
  throw new PlanaltoError(
    `Esgotadas ${retries} tentativas para ${url}`,
    lastError,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Constrói um `CorpusCandidate` a partir de um item do catálogo. */
export function lawToCandidate(law: OfficialLaw): CorpusCandidate {
  return {
    urn: law.urn,
    kind: law.kind,
    title: law.title,
    identifier: law.identifier,
    authority: law.authority,
    publishedAt: new Date(law.publishedAt),
    effectiveAt: new Date(law.publishedAt),
    sourceUrl: law.sourceUrl,
    sourceExternalId: law.key,
    tags: ["planalto", "oficial", ...law.domainPacks.map((p) => `domain:${p}`)],
    language: "pt-BR",
  };
}

/**
 * Converte uma `ParsedLaw` em `CorpusPayload` reutilizável pelo
 * pipeline de upsert (`repository.upsertCorpusPayload`).
 *
 * Texto canônico: cada artigo separado por blank-line, com cabeçalho
 * "Art. Nº" no início. Isso casa com o `legal-chunker-v2.ts`, que
 * segmenta por artigos.
 */
export function parsedLawToCorpusPayload(
  candidate: CorpusCandidate,
  parsed: ParsedLaw,
  htmlSource: string,
): CorpusPayload {
  const articleBlocks = parsed.articles
    .filter((a) => !a.isRevoked || a.text.length > 80)
    .map((a) => a.text.trim())
    .filter((t) => t.length > 0);

  const rawText = articleBlocks.join("\n\n");
  return {
    candidate,
    rawText,
    htmlSource,
    metadata: {
      source: "planalto",
      articleCount: parsed.articles.length,
      articleNumbers: parsed.articles.map((a) => a.number),
      revokedCount: parsed.stats.articlesRevoked,
      paragraphsTotal: parsed.stats.paragraphsTotal,
      bytes: parsed.stats.bytes,
    },
  };
}

/**
 * Implementação do `CorpusProviderClient` para o Planalto.
 * Usa o catálogo como fonte de discovery (`list`) e baixa+parseia
 * em `fetch`. Idempotente porque o repository fila por contentHash.
 */
export class PlanaltoCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.PLANALTO;
  private readonly fetchOptions: PlanaltoFetchOptions;

  constructor(opts: PlanaltoFetchOptions = {}) {
    this.fetchOptions = opts;
  }

  async list(filters: ListFilters = {}): Promise<ListPage> {
    let laws = OFFICIAL_LAWS;
    if (filters.kind === NormKind.CONSTITUTION) {
      laws = laws.filter((l) => l.kind === NormKind.CONSTITUTION);
    } else if (filters.kind === NormKind.CODE) {
      laws = laws.filter((l) => l.kind === NormKind.CODE);
    } else if (filters.kind === NormKind.ORDINARY_LAW) {
      laws = laws.filter((l) => l.kind === NormKind.ORDINARY_LAW);
    }
    return {
      candidates: laws.map(lawToCandidate),
      nextCursor: null,
      totalEstimated: laws.length,
    };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    if (!candidate.sourceUrl) {
      throw new PlanaltoError(`candidate ${candidate.urn} sem sourceUrl`);
    }
    const result = await fetchPlanaltoLaw(candidate.sourceUrl, this.fetchOptions);
    if (result.notModified || !result.html) {
      throw new PlanaltoError(
        `Planalto devolveu 304 sem cache para ${candidate.urn}. Configure ifNoneMatch/ifModifiedSince apenas quando há cache.`,
      );
    }
    const parsed = parsePlanaltoLawHtml(result.html);
    if (parsed.articles.length === 0) {
      throw new PlanaltoError(
        `Parser não encontrou nenhum artigo em ${candidate.sourceUrl}. ` +
          `Possível mudança de layout no Planalto. Inspecione manualmente.`,
      );
    }
    const payload = parsedLawToCorpusPayload(
      {
        ...candidate,
        ...(result.etag ? { etag: result.etag } : {}),
        ...(result.lastModified ? { lastModifiedAt: new Date(result.lastModified) } : {}),
      },
      parsed,
      result.html,
    );
    return payload;
  }
}
