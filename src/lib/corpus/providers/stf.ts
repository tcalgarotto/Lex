/**
 * Provider STF — Súmulas e Súmulas Vinculantes via JSON público do portal.
 *
 * Estratégia incremental e segura:
 *  - Súmulas Vinculantes: lista de IDs 1..N (atual ~62) é estável; cada uma
 *    tem URL canônica `https://portal.stf.jus.br/textos/verTexto.asp?servico=jurisprudenciaSumulaVinculante&pagina=sumulaVinculante&numero={n}`.
 *  - Súmulas: idem para `sumula`.
 *  - Para a primeira versão produzimos só a metadata + ementa (texto pequeno),
 *    porque o full HTML do STF tem variações que pedem normalização cuidadosa.
 *
 * O cliente é tolerante a falhas (retorna `null` quando o STF está offline ou
 * resposta vem em formato inesperado), evitando que uma falha externa derrube
 * o pipeline de ingestão.
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

const STF_BASE = "https://portal.stf.jus.br";

export class StfError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "StfError";
  }
}

type StfFetchOpts = {
  fetchImpl?: typeof fetch;
  /** Janela máxima de IDs a varrer por sync (proteção). */
  maxIds?: number;
  /** Token-bucket por minuto. Default 10 (rate-limit conservador). */
  ratePerMinute?: number;
  /** Timeout por request HTTP. Default 20s. */
  timeoutMs?: number;
};

export class StfCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.STF;
  private readonly fetchImpl: typeof fetch;
  private readonly maxIds: number;
  private readonly ratePerMinute: number;
  private readonly timeoutMs: number;

  constructor(opts: StfFetchOpts = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxIds = opts.maxIds ?? 80;
    this.ratePerMinute = opts.ratePerMinute ?? 10;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  async list(filters: ListFilters): Promise<ListPage> {
    const cursor = parseInt(filters.cursor ?? "1", 10);
    const pageSize = Math.max(1, Math.min(20, filters.pageSize ?? 10));
    const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 1;
    const end = Math.min(start + pageSize - 1, this.maxIds);

    const kind = filters.kind ?? NormKind.SUMULA_VINCULANTE;
    const candidates: CorpusCandidate[] = [];

    for (let n = start; n <= end; n++) {
      const meta = await this.fetchMeta(n, kind).catch(() => null);
      if (!meta) continue;
      candidates.push(meta);
    }

    const nextCursor = end < this.maxIds ? String(end + 1) : null;
    return { candidates, nextCursor };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    const num = candidate.identifier?.replace(/\D+/g, "");
    if (!num) throw new StfError("identifier sem número de súmula");
    const text = await this.fetchSumulaText(parseInt(num, 10), candidate.kind);
    return {
      candidate,
      rawText: text || candidate.ementa || `${candidate.title}\n\n(verbete vazio)`,
    };
  }

  /** Busca metadados de UMA súmula (vinculante ou ordinária). */
  private async fetchMeta(num: number, kind: NormKind): Promise<CorpusCandidate | null> {
    const isVinculante = kind === NormKind.SUMULA_VINCULANTE;
    const path = isVinculante ? "sumula-vinculante" : "sumula";
    const tag = isVinculante ? "Súmula Vinculante" : "Súmula STF";
    const sourceUrl = `${STF_BASE}/textos/verTexto.asp?servico=jurisprudencia${
      isVinculante ? "SumulaVinculante" : "Sumula"
    }&pagina=${isVinculante ? "sumulaVinculante" : "sumula"}&numero=${num}`;

    const text = await this.fetchSumulaText(num, kind);
    if (!text) return null;

    const ementa = text.replace(/\s+/g, " ").trim().slice(0, 600);

    return {
      urn: buildCanonicalUrn({
        country: "br",
        authority: "supremo.tribunal.federal",
        documentType: isVinculante ? "sumula.vinculante" : "sumula",
        number: String(num),
      }),
      kind,
      title: `${tag} ${num}`,
      identifier: `${tag} ${num}`,
      authority: "STF",
      tribunal: "STF",
      ementa,
      sourceUrl,
      sourceExternalId: `${path}-${num}`,
    };
  }

  private async fetchSumulaText(num: number, kind: NormKind): Promise<string> {
    const isVinculante = kind === NormKind.SUMULA_VINCULANTE;
    const url = `${STF_BASE}/textos/verTexto.asp?servico=jurisprudencia${
      isVinculante ? "SumulaVinculante" : "Sumula"
    }&pagina=${isVinculante ? "sumulaVinculante" : "sumula"}&numero=${num}`;
    await acquireProviderSlot({ scope: "stf", ratePerMinute: this.ratePerMinute });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { "User-Agent": "lex-corpus-sync/1.0 (+https://lex-navy.vercel.app)" },
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new StfError(`STF fetch falhou: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (res.status === 404) return "";
      throw new StfError(`STF respondeu ${res.status}`, res.status);
    }
    const html = await res.text();
    return extractTextFromStfHtml(html);
  }
}

/** Extrai o texto plano da página de súmula do STF (heurístico). */
export function extractTextFromStfHtml(html: string): string {
  if (!html) return "";
  // Pega o conteúdo da div principal de verbete; fallback pra strip global.
  const match = html.match(
    /<div[^>]*class=["']verbete["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  const inner = match?.[1] ?? html;
  return inner
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
