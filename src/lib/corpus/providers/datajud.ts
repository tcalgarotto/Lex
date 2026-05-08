/**
 * DataJud (CNJ) — fundação tipada.
 *
 * O Datajud é uma API REST do CNJ que devolve metadados processuais e
 * trechos textuais. Tem 2 modos:
 *  - **Pública** (consulta agregada por tribunal): `https://api-publica.datajud.cnj.jus.br/{ALIAS}/_search`
 *  - **Restrita** (por instituição/perfil): exige API key emitida pelo CNJ.
 *
 * Esta classe expõe a interface `CorpusProviderClient` com:
 *  - `list()` montando query Elasticsearch DSL para o alias informado.
 *  - `fetch()` buscando o documento específico por id externo.
 *
 * Como a integração varia muito por tribunal/alias e exige API key
 * configurada via env, deixamos a credencial opcional — sem credencial a
 * classe lança `DatajudError("missing key")` em runtime, mas todos os
 * helpers de construção de query são testáveis isoladamente.
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

export class DatajudError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DatajudError";
  }
}

export type DatajudOpts = {
  /** Alias do índice Datajud (ex.: "api_publica_tjsp"). */
  alias: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Token-bucket por minuto (default 30). */
  ratePerMinute?: number;
  /** Timeout HTTP por request. Default 30s. */
  timeoutMs?: number;
};

const DEFAULT_BASE = "https://api-publica.datajud.cnj.jus.br";

export class DatajudCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.DATAJUD;
  private readonly alias: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ratePerMinute: number;
  private readonly timeoutMs: number;

  constructor(opts: DatajudOpts) {
    this.alias = opts.alias;
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ratePerMinute = opts.ratePerMinute ?? 30;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async list(filters: ListFilters): Promise<ListPage> {
    const size = Math.max(1, Math.min(100, filters.pageSize ?? 20));
    const query = buildDatajudListQuery({
      ...(filters.cursor !== undefined ? { cursor: filters.cursor } : {}),
      size,
    });
    const res = await this.search(query);

    const candidates: CorpusCandidate[] = (res.hits?.hits ?? [])
      .map((h) => mapDatajudHitToCandidate(h, this.alias))
      .filter((c): c is CorpusCandidate => c !== null);

    // PIT/scroll com search_after: usa último valor de _score+_id.
    const last = res.hits?.hits?.[res.hits.hits.length - 1];
    const nextCursor =
      last?.sort && Array.isArray(last.sort) ? JSON.stringify(last.sort) : null;

    const out: ListPage = { candidates, nextCursor };
    if (typeof res.hits?.total?.value === "number") {
      out.totalEstimated = res.hits.total.value;
    }
    return out;
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    if (!candidate.sourceExternalId) {
      throw new DatajudError("candidate sem sourceExternalId");
    }
    const query = {
      query: { ids: { values: [candidate.sourceExternalId] } },
      size: 1,
    };
    const res = await this.search(query);
    const hit = res.hits?.hits?.[0];
    if (!hit) throw new DatajudError("documento não encontrado", 404);
    const rawText = extractRawTextFromDatajudHit(hit);
    return { candidate, rawText };
  }

  private async search(body: unknown): Promise<DatajudSearchResponse> {
    if (!this.apiKey) {
      throw new DatajudError("DATAJUD_API_KEY não configurada", 401);
    }
    await acquireProviderSlot({ scope: "datajud", ratePerMinute: this.ratePerMinute });
    const url = `${this.baseUrl}/${this.alias}/_search`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `APIKey ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "lex-corpus-sync/1.0 (+https://lex-navy.vercel.app)",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new DatajudError(`Datajud respondeu ${res.status}`, res.status);
      }
      return (await res.json()) as DatajudSearchResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Constrói uma query Elasticsearch sem executar (útil em dry-run).
   * Permite que o caller inspecione o body antes de enviar.
   */
  static buildQuery(args: DatajudFilters): Record<string, unknown> {
    return buildDatajudListQuery(args);
  }
}

/**
 * Query Elasticsearch para listagem incremental.
 *
 * Aceita filtros tipados que cobrem 90% dos casos:
 *  - tribunal           — sigla canônica (ex.: "TJSP")
 *  - classe             — código CNJ da classe processual
 *  - grau               — "G1" | "G2"
 *  - orgaoJulgador      — código numérico CNJ
 *  - assunto            — código CNJ do assunto
 *  - numeroProcesso     — número CNJ específico
 *  - dataAjuizamentoFrom / dataAjuizamentoTo (ISO yyyy-mm-dd)
 *  - atualizadoDesde    — para sync incremental por dataHoraUltimaAtualizacao
 *
 * `cursor` é o `search_after` opaco da página anterior (já em JSON).
 *
 * Documentado em https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo3.
 */
export type DatajudFilters = {
  cursor?: string | null;
  size: number;
  tribunal?: string;
  classe?: number | string;
  grau?: "G1" | "G2";
  orgaoJulgador?: number | string;
  assunto?: number | string;
  numeroProcesso?: string;
  dataAjuizamentoFrom?: string;
  dataAjuizamentoTo?: string;
  atualizadoDesde?: string;
};

export function buildDatajudListQuery(args: DatajudFilters): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];

  if (args.tribunal) must.push({ match: { tribunal: args.tribunal } });
  if (args.classe !== undefined)
    must.push({ match: { "classe.codigo": args.classe } });
  if (args.grau) must.push({ match: { grau: args.grau } });
  if (args.orgaoJulgador !== undefined)
    must.push({ match: { "orgaoJulgador.codigo": args.orgaoJulgador } });
  if (args.assunto !== undefined)
    must.push({ match: { "assuntos.codigo": args.assunto } });
  if (args.numeroProcesso) {
    const cleaned = String(args.numeroProcesso).replace(/\D+/g, "");
    if (cleaned) must.push({ match: { numeroProcesso: cleaned } });
  }
  if (args.dataAjuizamentoFrom || args.dataAjuizamentoTo) {
    const range: Record<string, string> = {};
    if (args.dataAjuizamentoFrom) range["gte"] = args.dataAjuizamentoFrom;
    if (args.dataAjuizamentoTo) range["lte"] = args.dataAjuizamentoTo;
    must.push({ range: { dataAjuizamento: range } });
  }
  if (args.atualizadoDesde) {
    must.push({
      range: { "@timestamp": { gte: args.atualizadoDesde } },
    });
  }

  const base: Record<string, unknown> = {
    size: args.size,
    sort: [{ "@timestamp": { order: "asc" } }, { _id: "asc" }],
    query: must.length === 0 ? { match_all: {} } : { bool: { must } },
  };
  if (args.cursor) {
    try {
      base["search_after"] = JSON.parse(args.cursor);
    } catch {
      // cursor inválido → ignora
    }
  }
  return base;
}

type DatajudHit = {
  _id?: string;
  _source?: Record<string, unknown>;
  sort?: unknown[];
};

type DatajudSearchResponse = {
  hits?: {
    total?: { value?: number };
    hits?: DatajudHit[];
  };
};

export function mapDatajudHitToCandidate(hit: DatajudHit, alias: string): CorpusCandidate | null {
  const src = hit._source ?? {};
  const numProc = String(src["numeroProcesso"] ?? "").replace(/\D+/g, "");
  if (!numProc) return null;
  const tribunal = String(src["tribunal"] ?? "").toUpperCase();
  const dataAjuiz = src["dataAjuizamento"];
  const publishedAt =
    typeof dataAjuiz === "string" ? new Date(dataAjuiz) : undefined;

  return {
    urn: buildCanonicalUrn({
      country: "br",
      authority: tribunal ? tribunal.toLowerCase().replace(/\s+/g, ".") : "datajud",
      documentType: "processo",
      number: numProc,
    }),
    kind: NormKind.JURISPRUDENCE_OTHER,
    title: `${tribunal || "Datajud"} processo ${numProc}`,
    identifier: numProc,
    tribunal,
    authority: tribunal,
    ...(publishedAt && Number.isFinite(publishedAt.getTime()) ? { publishedAt } : {}),
    sourceExternalId: hit._id || `datajud-${alias}-${numProc}`,
    sourceUrl: `https://www.cnj.jus.br/datajud/`,
  };
}

export function extractRawTextFromDatajudHit(hit: DatajudHit): string {
  const src = hit._source ?? {};
  const movimentos = (src["movimentos"] as Array<{ nome?: string; descricao?: string }> | undefined) ?? [];
  const lines: string[] = [];
  if (src["classe"]) lines.push(`Classe: ${JSON.stringify(src["classe"])}`);
  if (src["assuntos"]) lines.push(`Assuntos: ${JSON.stringify(src["assuntos"])}`);
  if (movimentos.length > 0) {
    lines.push("Movimentos:");
    for (const m of movimentos.slice(0, 50)) {
      lines.push(`- ${m.nome ?? ""} ${m.descricao ?? ""}`.trim());
    }
  }
  return lines.join("\n");
}
