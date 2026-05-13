/**
 * Provider Senado Federal — Dados Abertos.
 *
 * API REST pública, sem chave:
 *   https://legis.senado.leg.br/dadosabertos
 *
 * Cobertura ativada: **Matérias legislativas** (PL, PEC, PLS, PLN, etc.). A
 * API devolve XML por padrão e JSON quando o cabeçalho `Accept: application/json`
 * está presente. Usamos JSON.
 *
 * Política:
 *  - Rate-limit cooperativo (default 30 req/min — API pública sem auth).
 *  - Timeout 30s por request.
 *  - Identificador de cliente: User-Agent identificável.
 */

import { CorpusProvider, NormKind } from "@prisma/client";
import { buildCanonicalUrn } from "@/lib/corpus/urn";
import { acquireProviderSlot } from "./rate-limit";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

const DEFAULT_BASE = "https://legis.senado.leg.br/dadosabertos";

export class SenadoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SenadoError";
  }
}

type SenadoOpts = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  ratePerMinute?: number;
  timeoutMs?: number;
  sigla?: string;
  /**
   * Quantos itens varrer por página. O Senado pagina por intervalo de número
   * (lista por sigla/ano) — usamos cursor numérico (ano).
   */
  yearsPerPage?: number;
};

type SenadoMateria = {
  CodigoMateria?: string;
  Codigo?: string;
  SiglaSubtipoMateria?: string;
  Sigla?: string;
  NumeroMateria?: string;
  Numero?: string;
  AnoMateria?: string;
  Ano?: string;
  EmentaMateria?: string;
  Ementa?: string;
  DescricaoIdentificacaoMateria?: string;
  DescricaoIdentificacao?: string;
  DataApresentacao?: string;
  Data?: string;
};

type SenadoListResponse = {
  PesquisaBasicaMateria?: {
    Materias?: { Materia?: SenadoMateria | SenadoMateria[] };
  };
};

type SenadoDetalheResponse = {
  DetalheMateria?: {
    Materia?: {
      IdentificacaoMateria?: SenadoMateria;
      DadosBasicosMateria?: { EmentaMateria?: string; ExplicacaoEmentaMateria?: string };
    };
  };
};

/**
 * Provider Senado — alimenta corpus com matérias legislativas.
 */
export class SenadoCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.SENADO;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ratePerMinute: number;
  private readonly timeoutMs: number;
  private readonly yearsPerPage: number;
  private readonly sigla: string;

  constructor(opts: SenadoOpts = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ratePerMinute = opts.ratePerMinute ?? 30;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.yearsPerPage = Math.max(1, Math.min(5, opts.yearsPerPage ?? 1));
    this.sigla = opts.sigla ?? "PL";
  }

  /**
   * Lista materias por (ano, sigla). Cursor é o ano: começamos no atual e
   * descemos até o ano informado em `pageSize` (a API não oferece offset
   * arbitrário sobre o universo todo).
   */
  async list(filters: ListFilters): Promise<ListPage> {
    const startYear = filters.cursor
      ? Math.max(1900, parseInt(filters.cursor, 10) || new Date().getFullYear())
      : new Date().getFullYear();

    const url = new URL(`${this.baseUrl}/materia/pesquisa/lista`);
    url.searchParams.set("ano", String(startYear));
    url.searchParams.set("sigla", this.sigla);

    const json = await this.getJson<SenadoListResponse>(url.toString());
    const root = json.PesquisaBasicaMateria?.Materias?.Materia;
    const list: SenadoMateria[] = !root
      ? []
      : Array.isArray(root)
        ? root
        : [root];

    const candidates = list
      .map((m) => this.toCandidate(m))
      .filter((c): c is CorpusCandidate => c !== null);

    const nextYear = startYear - 1;
    const nextCursor = nextYear >= 1988 ? String(nextYear) : null;

    return { candidates, nextCursor };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    if (!candidate.sourceExternalId) {
      throw new SenadoError(`candidate sem sourceExternalId (${candidate.urn})`);
    }
    const codigo = candidate.sourceExternalId.replace(/^senado-/, "");
    const json = await this.getJson<SenadoDetalheResponse>(
      `${this.baseUrl}/materia/${encodeURIComponent(codigo)}`,
    );
    const m = json.DetalheMateria?.Materia;
    const lines: string[] = [];
    const id = m?.IdentificacaoMateria;
    if (id) {
      lines.push(`${id.SiglaSubtipoMateria ?? ""} ${id.NumeroMateria ?? ""}/${id.AnoMateria ?? ""}`.trim());
    }
    const ementa = m?.DadosBasicosMateria?.EmentaMateria ?? id?.EmentaMateria;
    if (ementa) lines.push(`\nEmenta: ${ementa}`);
    const explic = m?.DadosBasicosMateria?.ExplicacaoEmentaMateria;
    if (explic) lines.push(`\nExplicação: ${explic}`);

    return {
      candidate,
      rawText: lines.join("\n").trim() || candidate.title,
      metadata: {
        source: "senado",
        codigo,
      },
    };
  }

  private toCandidate(m: SenadoMateria): CorpusCandidate | null {
    const codigo = m.CodigoMateria ?? m.Codigo;
    const numero = m.NumeroMateria ?? m.Numero;
    const ano = m.AnoMateria ?? m.Ano;
    if (!codigo || !numero || !ano) return null;
    const siglaRaw = m.SiglaSubtipoMateria ?? m.Sigla ?? "MAT";
    const sigla = siglaRaw.toLowerCase();
    const isoDate = (m.DataApresentacao ?? m.Data ?? `${ano}-01-01`).slice(0, 10);
    const date = new Date(isoDate);
    const urn = buildCanonicalUrn({
      country: "br",
      authority: "senado.federal",
      documentType: `materia.${sigla}`,
      date: isoDate,
      number: String(numero),
    });
    const title =
      m.DescricaoIdentificacaoMateria ?? m.DescricaoIdentificacao ?? `${siglaRaw} ${numero}/${ano}`;
    const c: CorpusCandidate = {
      urn,
      kind: NormKind.OTHER,
      title,
      identifier: `${siglaRaw} ${numero}/${ano}`,
      authority: "Senado Federal",
      tribunal: "SENADO",
      sourceExternalId: `senado-${codigo}`,
      sourceUrl: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`,
    };
    const ementa = m.EmentaMateria ?? m.Ementa;
    if (ementa) c.ementa = ementa;
    if (!isNaN(date.getTime())) c.publishedAt = date;
    return c;
  }

  private async getJson<T>(url: string): Promise<T> {
    await acquireProviderSlot({ scope: "senado", ratePerMinute: this.ratePerMinute });
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
        throw new SenadoError(`Senado respondeu ${res.status} em ${url}`, res.status);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function senadoProvider(opts?: SenadoOpts): CorpusProviderClient {
  return new SenadoCorpusProvider(opts);
}
