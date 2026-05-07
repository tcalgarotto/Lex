/**
 * Provider STJ — fundação para Súmulas e Jurisprudência via portal.
 *
 * Status: **scaffold** estruturado, com endpoint apontado para `scon.stj.jus.br`.
 *  - O STJ não publica API JSON pública estável; a forma robusta é varrer o
 *    SCON com formulário web. Esta classe expõe a interface canônica e
 *    implementa fetching mínimo com headers identificáveis.
 *  - A versão de produção fará scraping HTML do SCON com cache + cookies.
 *    Aqui mantemos o fluxo idempotente (URN-LEX baseado em número), de modo
 *    que assim que o parser HTML for implementado, basta plugá-lo.
 *
 * Por que entregamos como scaffold testável: (a) o pipeline (Inngest +
 * repository) já é compatível com qualquer `CorpusProviderClient`, (b) os
 * testes garantem o contrato — quando o parser HTML for plugado, ele entra
 * sem refactor.
 */

import { CorpusProvider, NormKind } from "@prisma/client";
import { buildCanonicalUrn } from "@/lib/corpus/urn";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

const STJ_BASE = "https://scon.stj.jus.br";

export class StjError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "StjError";
  }
}

export type StjFetchOpts = {
  fetchImpl?: typeof fetch;
  /** Janela máxima de IDs por sync. */
  maxIds?: number;
  /** Implementação de extração — injetável p/ testes ou plugins HTML reais. */
  extractor?: StjExtractor;
};

export type StjExtractor = (html: string) => { ementa?: string; rawText?: string } | null;

export class StjCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.STJ;
  private readonly fetchImpl: typeof fetch;
  private readonly maxIds: number;
  private readonly extractor: StjExtractor;

  constructor(opts: StjFetchOpts = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxIds = opts.maxIds ?? 60;
    this.extractor = opts.extractor ?? defaultStjExtractor;
  }

  async list(filters: ListFilters): Promise<ListPage> {
    if (filters.kind && filters.kind !== NormKind.SUMULA_STJ) {
      // Apenas súmulas suportadas hoje; jurisprudência via DataJud (planejado).
      return { candidates: [], nextCursor: null };
    }
    const cursor = parseInt(filters.cursor ?? "1", 10);
    const pageSize = Math.max(1, Math.min(20, filters.pageSize ?? 10));
    const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 1;
    const end = Math.min(start + pageSize - 1, this.maxIds);

    const candidates: CorpusCandidate[] = [];
    for (let n = start; n <= end; n++) {
      const meta = await this.fetchMeta(n).catch(() => null);
      if (meta) candidates.push(meta);
    }

    const nextCursor = end < this.maxIds ? String(end + 1) : null;
    return { candidates, nextCursor };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    const num = candidate.identifier?.replace(/\D+/g, "");
    if (!num) throw new StjError("identifier sem número de súmula");
    const url = `${STJ_BASE}/SCON/sumanot/toc.jsp?livre=${num}`;
    const html = await this.getHtml(url);
    const extracted = this.extractor(html);
    const rawText = extracted?.rawText ?? candidate.ementa ?? `${candidate.title}\n\n(verbete vazio)`;
    return { candidate, rawText };
  }

  private async fetchMeta(num: number): Promise<CorpusCandidate | null> {
    // O scaffold devolve metadata mínima sem visitar o portal — quando a
    // varredura real for ativada, basta swap por uma chamada `getHtml`+parse.
    return {
      urn: buildCanonicalUrn({
        country: "br",
        authority: "superior.tribunal.justica",
        documentType: "sumula",
        number: String(num),
      }),
      kind: NormKind.SUMULA_STJ,
      title: `Súmula STJ ${num}`,
      identifier: `Súmula STJ ${num}`,
      authority: "STJ",
      tribunal: "STJ",
      sourceUrl: `${STJ_BASE}/SCON/sumanot/toc.jsp?livre=${num}`,
      sourceExternalId: `sumula-${num}`,
    };
  }

  private async getHtml(url: string): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { "User-Agent": "lex-corpus-sync/1.0" },
      });
    } catch (err) {
      throw new StjError(`STJ fetch falhou: ${(err as Error).message}`);
    }
    if (!res.ok) throw new StjError(`STJ respondeu ${res.status}`, res.status);
    return res.text();
  }
}

/** Extractor padrão (heurístico). Plug-able em prod com parser dedicado. */
export function defaultStjExtractor(html: string): { ementa?: string; rawText?: string } | null {
  if (!html) return null;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  const ementa = text.slice(0, 600);
  return { ementa, rawText: text };
}
