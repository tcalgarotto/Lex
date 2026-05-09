/**
 * Provider Câmara dos Deputados — Dados Abertos.
 *
 * API REST pública, sem chave:
 *   https://dadosabertos.camara.leg.br/api/v2
 *
 * Cobertura ativada: **Proposições legislativas** (PL, PEC, MPV, etc.). Cada
 * proposição vira um `LegalNorm` com `kind = OTHER` (proposta legislativa)
 * e `tribunal = "CAMARA"`. Quando a proposição é sancionada, a citação
 * automática para a `Lei nº ...` é resolvida pelo grafo de citações.
 *
 * Política:
 *  - Rate-limit cooperativo (default 30 req/min — API pública sem auth).
 *  - Timeout 30s por request.
 *  - Sem scraping HTML: a API devolve JSON estável.
 *  - Identificador de cliente: User-Agent identificável.
 */

import type { CorpusProvider, NormKind } from "@prisma/client";
import { buildCanonicalUrn } from "@/lib/corpus/urn";
import { acquireProviderSlot } from "./rate-limit";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

const DEFAULT_BASE = "https://dadosabertos.camara.leg.br/api/v2";

export class CamaraError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CamaraError";
  }
}

type CamaraOpts = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  ratePerMinute?: number;
  timeoutMs?: number;
  /**
   * Limita itens por página da API. A Câmara aceita até 100. Default 50.
   */
  itensPorPagina?: number;
};

type CamaraProposicao = {
  id: number;
  uri: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa?: string;
  dataApresentacao?: string;
};

type CamaraResponse<T> = {
  dados: T;
  links?: Array<{ rel: string; href: string }>;
};

type CamaraDetalhe = CamaraProposicao & {
  ementaDetalhada?: string;
  keywords?: string;
  statusProposicao?: { descricaoTramitacao?: string; descricaoSituacao?: string };
  uriAutores?: string;
};

/**
 * Provider Câmara — alimenta corpus com proposições legislativas. Ideal para
 * monitorar tramitação de PLs/PECs e correlacionar com normas existentes.
 */
export class CamaraCorpusProvider implements CorpusProviderClient {
  readonly id = "CAMARA" as CorpusProvider;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ratePerMinute: number;
  private readonly timeoutMs: number;
  private readonly itensPorPagina: number;

  constructor(opts: CamaraOpts = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ratePerMinute = opts.ratePerMinute ?? 30;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.itensPorPagina = Math.max(1, Math.min(100, opts.itensPorPagina ?? 50));
  }

  async list(filters: ListFilters): Promise<ListPage> {
    const pagina = filters.cursor
      ? Math.max(1, parseInt(filters.cursor, 10) || 1)
      : 1;
    const url = new URL(`${this.baseUrl}/proposicoes`);
    url.searchParams.set("itens", String(this.itensPorPagina));
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("ordem", "DESC");
    url.searchParams.set("ordenarPor", "id");

    const json = await this.getJson<CamaraResponse<CamaraProposicao[]>>(
      url.toString(),
    );

    const candidates: CorpusCandidate[] = json.dados.map((p) =>
      this.toCandidate(p),
    );

    const next = json.links?.find((l) => l.rel === "next");
    const nextCursor = next ? String(pagina + 1) : null;

    return { candidates, nextCursor };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    if (!candidate.sourceExternalId) {
      throw new CamaraError(`candidate sem sourceExternalId (${candidate.urn})`);
    }
    const id = candidate.sourceExternalId.replace(/^camara-/, "");
    const detalhe = await this.getJson<CamaraResponse<CamaraDetalhe>>(
      `${this.baseUrl}/proposicoes/${encodeURIComponent(id)}`,
    );
    const d = detalhe.dados;
    const lines: string[] = [];
    lines.push(`${d.siglaTipo} ${d.numero}/${d.ano}`);
    if (d.ementa) lines.push(`\nEmenta: ${d.ementa}`);
    if (d.ementaDetalhada) lines.push(`\nDetalhamento: ${d.ementaDetalhada}`);
    if (d.keywords) lines.push(`\nKeywords: ${d.keywords}`);
    if (d.statusProposicao?.descricaoTramitacao) {
      lines.push(`\nTramitação: ${d.statusProposicao.descricaoTramitacao}`);
    }
    if (d.statusProposicao?.descricaoSituacao) {
      lines.push(`\nSituação: ${d.statusProposicao.descricaoSituacao}`);
    }

    return {
      candidate,
      rawText: lines.join("\n").trim() || candidate.title,
      metadata: {
        source: "camara",
        camaraId: d.id,
        uri: d.uri,
        siglaTipo: d.siglaTipo,
        numero: d.numero,
        ano: d.ano,
      },
    };
  }

  private toCandidate(p: CamaraProposicao): CorpusCandidate {
    const isoDate = (p.dataApresentacao ?? `${p.ano}-01-01`).slice(0, 10);
    const urn = buildCanonicalUrn({
      country: "br",
      authority: "camara.deputados",
      documentType: `proposicao.${p.siglaTipo.toLowerCase()}`,
      date: isoDate,
      number: String(p.numero),
    });
    const c: CorpusCandidate = {
      urn,
      kind: "OTHER" as NormKind,
      title: `${p.siglaTipo} ${p.numero}/${p.ano}`,
      identifier: `${p.siglaTipo} ${p.numero}/${p.ano}`,
      authority: "Câmara dos Deputados",
      tribunal: "CAMARA",
      sourceExternalId: `camara-${p.id}`,
      sourceUrl: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
    };
    if (p.ementa) c.ementa = p.ementa;
    if (p.dataApresentacao) {
      const dt = new Date(p.dataApresentacao);
      if (!isNaN(dt.getTime())) c.publishedAt = dt;
    }
    return c;
  }

  private async getJson<T>(url: string): Promise<T> {
    await acquireProviderSlot({ scope: "camara", ratePerMinute: this.ratePerMinute });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        signal: ctrl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "lex-corpus-sync/1.0 (+https://lex-navy.vercel.app)",
        },
      });
      if (!res.ok) {
        throw new CamaraError(`Câmara respondeu ${res.status} em ${url}`, res.status);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function camaraProvider(opts?: CamaraOpts): CorpusProviderClient {
  return new CamaraCorpusProvider(opts);
}
