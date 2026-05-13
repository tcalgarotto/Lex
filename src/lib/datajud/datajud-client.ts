import { getEnv } from "@/lib/env";
import { buildDatajudAuthorizationHeader } from "@/lib/corpus/providers/datajud";

export class DataJudClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code: string = "DATAJUD_ERROR",
  ) {
    super(message);
    this.name = "DataJudClientError";
  }
}

export type DataJudProviderMode = "live" | "mock" | "off";

export type DataJudHit = {
  _id?: string;
  _source?: Record<string, unknown>;
  sort?: unknown[];
};

export type DataJudSearchResponse = {
  took?: number;
  timed_out?: boolean;
  hits?: {
    total?: number | { value?: number };
    hits?: DataJudHit[];
  };
  aggregations?: Record<string, unknown>;
};

export type DataJudClientOptions = {
  alias: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  mode?: DataJudProviderMode;
};

const DEFAULT_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

export function getDataJudProviderMode(): DataJudProviderMode {
  const env = getEnv();
  if (env.DATAJUD_PROVIDER_MODE) return env.DATAJUD_PROVIDER_MODE;
  if (env.DATAJUD_MODE === "disabled") return "off";
  if (env.DATAJUD_MODE === "fixture") return "mock";
  return "live";
}

export function createDataJudClient(alias: string): DataJudClient {
  const env = getEnv();
  return new DataJudClient({
    alias,
    apiKey: env.DATAJUD_API_KEY,
    baseUrl: env.DATAJUD_BASE_URL,
    timeoutMs: 30_000,
    retries: 1,
    mode: getDataJudProviderMode(),
  });
}

export function buildDataJudSearchByCnjQuery(cnjDigits: string): Record<string, unknown> {
  return {
    size: 1,
    query: {
      bool: {
        must: [{ match: { numeroProcesso: cnjDigits } }],
      },
    },
  };
}

export function buildDataJudAutocompleteQuery(prefixDigits: string, size = 8): Record<string, unknown> {
  return {
    size: Math.max(1, Math.min(size, 10)),
    _source: [
      "numeroProcesso",
      "tribunal",
      "classe",
      "orgaoJulgador",
      "dataAjuizamento",
      "dataHoraUltimaAtualizacao",
    ],
    query: {
      prefix: {
        numeroProcesso: prefixDigits,
      },
    },
    sort: [{ "@timestamp": { order: "desc" } }],
  };
}

export class DataJudClient {
  private readonly alias: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly mode: DataJudProviderMode;

  constructor(options: DataJudClientOptions) {
    this.alias = options.alias;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retries = options.retries ?? 1;
    this.mode = options.mode ?? "live";
  }

  async health(): Promise<{ ok: boolean; status: string; alias: string; tookMs: number }> {
    const started = Date.now();
    if (this.mode === "off") {
      return { ok: false, status: "disabled", alias: this.alias, tookMs: 0 };
    }
    if (this.mode === "mock") {
      return { ok: true, status: "mock", alias: this.alias, tookMs: 0 };
    }
    await this.search({ size: 0, query: { match_all: {} } });
    return { ok: true, status: "live", alias: this.alias, tookMs: Date.now() - started };
  }

  async searchByCnj(cnjDigits: string): Promise<DataJudHit | null> {
    const response = await this.search(buildDataJudSearchByCnjQuery(cnjDigits));
    return response.hits?.hits?.[0] ?? null;
  }

  async autocomplete(prefixDigits: string, size = 8): Promise<DataJudHit[]> {
    if (prefixDigits.length < 7) return [];
    const response = await this.search(buildDataJudAutocompleteQuery(prefixDigits, size));
    return response.hits?.hits ?? [];
  }

  async search(body: unknown): Promise<DataJudSearchResponse> {
    if (this.mode === "off") {
      throw new DataJudClientError("DataJud desativado por configuração", 503, "DATAJUD_DISABLED");
    }
    if (this.mode === "mock") return { hits: { total: { value: 0 }, hits: [] } };
    if (!this.apiKey?.trim()) {
      throw new DataJudClientError("DATAJUD_API_KEY não configurada", 401, "DATAJUD_MISSING_KEY");
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await this.fetchSearch(body);
      } catch (error) {
        lastError = error;
        if (error instanceof DataJudClientError && error.status && error.status < 500) {
          throw error;
        }
        if (attempt < this.retries) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new DataJudClientError("Falha desconhecida no DataJud");
  }

  private async fetchSearch(body: unknown): Promise<DataJudSearchResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${this.alias}/_search`, {
        method: "POST",
        headers: {
          Authorization: buildDatajudAuthorizationHeader(this.apiKey ?? ""),
          "Content-Type": "application/json",
          "User-Agent": "lex-datajud-processes/1.0 (+https://lex-navy.vercel.app)",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!response.ok) {
        throw new DataJudClientError(`DataJud respondeu ${response.status}`, response.status);
      }
      return (await response.json()) as DataJudSearchResponse;
    } catch (error) {
      if (error instanceof DataJudClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new DataJudClientError("Tempo esgotado consultando DataJud", 504, "DATAJUD_TIMEOUT");
      }
      throw new DataJudClientError(
        error instanceof Error ? error.message : "Falha de rede consultando DataJud",
        502,
        "DATAJUD_NETWORK",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
