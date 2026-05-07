/**
 * Provider LexML — fonte oficial nacional de normas (legislativas, executivas
 * e jurídicas) federadas pelo portal LexML Brasil.
 *
 * APIs disponíveis (públicas, sem auth):
 *   - SRU  (Search/Retrieve via URL)  https://www.lexml.gov.br/busca/SRU
 *   - OAI-PMH                         https://www.lexml.gov.br/busca/OAIQuery
 *
 * Optamos por SRU para listagem incremental por data (mais simples que OAI-PMH
 * para iteração paginada). O cursor é o `startRecord` da SRU.
 *
 * Em caso de conexão restrita, o provider deve falhar de maneira benigna
 * (exceções tipadas) para o caller decidir retry/back-off.
 *
 * NOTA: Este provider faz fetch HTTP. Em testes unitários, prefira
 * `FixtureCorpusProvider`. Para integração contra LexML real, use o
 * `LexmlCorpusProvider` com fetch real.
 */

import { CorpusProvider, NormKind } from "@prisma/client";
import {
  buildCanonicalUrn,
  classifyKindFromUrn,
  parseUrnLex,
} from "@/lib/corpus/urn";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

const SRU_BASE = "https://www.lexml.gov.br/busca/SRU";
const DEFAULT_PAGE_SIZE = 50;

export class LexmlError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = "LexmlError";
  }
}

/** Constrói query CQL para SRU baseada nos filtros. */
function buildCqlQuery(filters: ListFilters): string {
  const clauses: string[] = [];

  // Heurística: mapeia nosso `NormKind` em fragmentos de URN-LEX para filtrar.
  if (filters.kind) {
    const fragment = kindToUrnFragment(filters.kind);
    if (fragment) clauses.push(`urn=urn:lex:br:federal:${fragment}`);
  } else {
    clauses.push("urn=urn:lex:br:federal:lei");
  }

  return clauses.length > 0 ? clauses.join(" AND ") : "tipoDocumento=lei";
}

function kindToUrnFragment(kind: NormKind): string | null {
  switch (kind) {
    case NormKind.ORDINARY_LAW:
      return "lei";
    case NormKind.COMPLEMENTARY_LAW:
      return "lei.complementar";
    case NormKind.DECREE:
      return "decreto";
    case NormKind.DECREE_LAW:
      return "decreto-lei";
    case NormKind.CONSTITUTIONAL_AMENDMENT:
      return "emenda.constitucional";
    case NormKind.PROVISIONAL_MEASURE:
      return "medida.provisoria";
    case NormKind.CONSTITUTION:
      return "constituicao";
    default:
      return null;
  }
}

type ParsedSruRecord = {
  urn: string;
  title: string;
  identifier?: string;
  publishedAt?: Date;
  ementa?: string;
  sourceUrl?: string;
};

/** Parser leve de XML SRU. Não cobre todos os casos, foca no que importa. */
export function parseSruResponse(xml: string): {
  records: ParsedSruRecord[];
  total: number;
} {
  const records: ParsedSruRecord[] = [];
  const total = readNumber(xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/));

  const recordRegex = /<record>([\s\S]*?)<\/record>/g;
  let m: RegExpExecArray | null;
  while ((m = recordRegex.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const urn = readText(block.match(/<urn>([^<]+)<\/urn>/));
    if (!urn) continue;
    const title = readText(block.match(/<title>([\s\S]*?)<\/title>/)) ?? urn;
    const identifier = readText(block.match(/<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/));
    const ementa = readText(block.match(/<description>([\s\S]*?)<\/description>/));
    const dateStr = readText(block.match(/<date>([^<]+)<\/date>/));
    const url = readText(block.match(/<dcterms:URI[^>]*>([^<]+)<\/dcterms:URI>/));
    const r: ParsedSruRecord = {
      urn: urn.trim().toLowerCase(),
      title: cleanXml(title),
    };
    if (identifier) r.identifier = identifier.trim();
    if (ementa) r.ementa = cleanXml(ementa);
    const publishedAt = dateStr ? safeDate(dateStr.trim()) : undefined;
    if (publishedAt) r.publishedAt = publishedAt;
    if (url) r.sourceUrl = url.trim();
    records.push(r);
  }

  return { records, total: total ?? records.length };
}

function readText(match: RegExpMatchArray | null): string | null {
  if (!match || !match[1]) return null;
  return match[1].trim();
}

function readNumber(match: RegExpMatchArray | null): number | null {
  if (!match || !match[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function cleanXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDate(s: string): Date | undefined {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export type LexmlOptions = {
  /** Permite override de URL (mock em testes/integração). */
  baseUrl?: string;
  /** Permite injetar `fetch` (testes/observabilidade). */
  fetchImpl?: typeof fetch;
  /** Timeout por request. */
  timeoutMs?: number;
};

export class LexmlCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.LEXML;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LexmlOptions = {}) {
    this.baseUrl = options.baseUrl ?? SRU_BASE;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async list(filters: ListFilters): Promise<ListPage> {
    const startRecord = filters.cursor ? Math.max(1, parseInt(filters.cursor, 10) || 1) : 1;
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    const params = new URLSearchParams({
      operation: "searchRetrieve",
      version: "1.1",
      query: buildCqlQuery(filters),
      maximumRecords: String(pageSize),
      startRecord: String(startRecord),
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const xml = await this.fetchXml(url);
    const { records, total } = parseSruResponse(xml);

    const candidates: CorpusCandidate[] = records
      .map((r) => this.normalizeRecord(r))
      .filter((c): c is CorpusCandidate => c !== null);

    const consumed = startRecord + records.length - 1;
    const nextCursor = consumed < total ? String(consumed + 1) : null;

    return { candidates, nextCursor, totalEstimated: total };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    if (!candidate.sourceUrl) {
      throw new LexmlError(
        `Candidato ${candidate.urn} sem sourceUrl para fetch`,
        undefined,
        false,
      );
    }
    const html = await this.fetchHtml(candidate.sourceUrl);
    const rawText = stripHtml(html);
    return {
      candidate,
      rawText,
      htmlSource: html,
      metadata: { source: "lexml", url: candidate.sourceUrl },
    };
  }

  private normalizeRecord(r: ParsedSruRecord): CorpusCandidate | null {
    let urn;
    try {
      urn = parseUrnLex(r.urn);
    } catch {
      return null;
    }
    const kind = classifyKindFromUrn(urn);
    const canonicalUrn = buildCanonicalUrn({
      authority: urn.authority,
      documentType: urn.documentType,
      ...(urn.date ? { date: urn.date } : {}),
      ...(urn.number ? { number: urn.number } : {}),
      ...(urn.uf ? { uf: urn.uf } : {}),
    });

    const candidate: CorpusCandidate = {
      urn: canonicalUrn,
      kind,
      title: r.title,
      sourceExternalId: r.urn,
    };
    if (r.identifier) candidate.identifier = r.identifier;
    if (r.publishedAt) candidate.publishedAt = r.publishedAt;
    if (r.ementa) candidate.ementa = r.ementa;
    if (r.sourceUrl) candidate.sourceUrl = r.sourceUrl;
    return candidate;
  }

  private async fetchXml(url: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        signal: ctrl.signal,
        headers: { Accept: "application/xml" },
      });
      if (!res.ok) {
        throw new LexmlError(
          `LexML respondeu ${res.status} em ${url}`,
          res.status,
          res.status >= 500 || res.status === 429,
        );
      }
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        signal: ctrl.signal,
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
      if (!res.ok) {
        throw new LexmlError(
          `Fonte respondeu ${res.status} em ${url}`,
          res.status,
          res.status >= 500 || res.status === 429,
        );
      }
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Strip leve de HTML pra texto bruto. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|li|tr|h\d|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function lexmlProvider(options?: LexmlOptions): CorpusProviderClient {
  return new LexmlCorpusProvider(options);
}
