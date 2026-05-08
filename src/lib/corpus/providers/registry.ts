/**
 * Registry unificado dos provedores de corpus jurídico.
 *
 * Padroniza:
 *  - status() → indica se o provider está apto (live/fixture/disabled/not_configured/down)
 *  - factory() → cria a instância configurada conforme env
 *  - metadata estática (envKeys, requiresApiKey, sourceKind, prioridade)
 *
 * Use este registry em scripts (`corpus:sync`, `corpus:stats`, `datajud:check`)
 * e em `/api/admin/corpus-stats` para apresentar status agregado.
 */

import { CorpusProvider } from "@prisma/client";
import { getEnv } from "@/lib/env";
import type { CorpusProviderClient } from "./types";
import { fixtureProvider } from "./fixture";
import { LexmlCorpusProvider } from "./lexml";
import { StfCorpusProvider } from "./stf";
import { StjCorpusProvider } from "./stj";
import { DatajudCorpusProvider } from "./datajud";

export type CorpusProviderStatusCode =
  | "ok"
  | "degraded"
  | "down"
  | "not_configured"
  | "disabled";

export type CorpusProviderStatus = {
  id: CorpusProvider;
  label: string;
  status: CorpusProviderStatusCode;
  mode: "live" | "fixture" | "disabled";
  requiresApiKey: boolean;
  envKeys: string[];
  baseUrl?: string;
  rateLimitPerMinute?: number;
  detail?: string;
  hint?: string;
};

export type CorpusProviderEntry = {
  id: CorpusProvider;
  label: string;
  /** Quanto maior, mais cedo aparece em UIs e mais cedo é seedado. */
  priority: number;
  requiresApiKey: boolean;
  envKeys: string[];
  /** Tipo dominante de conteúdo: "norms" alimenta lex_corpus_norms, "jurisprudence" o outro. */
  sourceKind: "norms" | "jurisprudence" | "process_metadata" | "legislative_proposals";
  status(): CorpusProviderStatus;
  /**
   * Constrói a instância. Lança se status === "disabled" ou "not_configured".
   * Para inspeção sem efeitos, use `status()`.
   */
  factory(): CorpusProviderClient;
};

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return false;
}

const FIXTURE_ENTRY: CorpusProviderEntry = {
  id: CorpusProvider.FIXTURE,
  label: "Fixture (demo embutida)",
  priority: 0,
  requiresApiKey: false,
  envKeys: [],
  sourceKind: "norms",
  status(): CorpusProviderStatus {
    return {
      id: CorpusProvider.FIXTURE,
      label: "Fixture (demo embutida)",
      status: "ok",
      mode: "fixture",
      requiresApiKey: false,
      envKeys: [],
    };
  },
  factory() {
    return fixtureProvider();
  },
};

const LEXML_ENTRY: CorpusProviderEntry = {
  id: CorpusProvider.LEXML,
  label: "LexML (Senado/CNJ — vade mecum federal)",
  priority: 100,
  requiresApiKey: false,
  envKeys: ["LEXML_BASE_URL", "LEXML_PROVIDER_MODE", "ENABLE_LEXML_PROVIDER"],
  sourceKind: "norms",
  status(): CorpusProviderStatus {
    const env = getEnv();
    const enabled = bool(env.ENABLE_LEXML_PROVIDER);
    if (!enabled) {
      return {
        id: CorpusProvider.LEXML,
        label: this.label,
        status: "disabled",
        mode: "disabled",
        requiresApiKey: false,
        envKeys: this.envKeys,
        baseUrl: env.LEXML_BASE_URL,
        rateLimitPerMinute: env.LEXML_RATE_LIMIT_PER_MINUTE,
        hint: "Defina ENABLE_LEXML_PROVIDER=true para reativar.",
      };
    }
    return {
      id: CorpusProvider.LEXML,
      label: this.label,
      status: "ok",
      mode: env.LEXML_PROVIDER_MODE,
      requiresApiKey: false,
      envKeys: this.envKeys,
      baseUrl: env.LEXML_BASE_URL,
      rateLimitPerMinute: env.LEXML_RATE_LIMIT_PER_MINUTE,
    };
  },
  factory() {
    const env = getEnv();
    if (!bool(env.ENABLE_LEXML_PROVIDER)) {
      throw new Error("LEXML provider está disabled");
    }
    if (env.LEXML_PROVIDER_MODE === "fixture") return fixtureProvider();
    return new LexmlCorpusProvider({
      baseUrl: env.LEXML_BASE_URL,
      timeoutMs: 30_000,
    });
  },
};

const STF_ENTRY: CorpusProviderEntry = {
  id: CorpusProvider.STF,
  label: "STF (súmulas + súmulas vinculantes)",
  priority: 80,
  requiresApiKey: false,
  envKeys: ["STF_BASE_URL", "STF_PROVIDER_MODE", "ENABLE_STF_PROVIDER"],
  sourceKind: "jurisprudence",
  status(): CorpusProviderStatus {
    const env = getEnv();
    if (!bool(env.ENABLE_STF_PROVIDER)) {
      return {
        id: CorpusProvider.STF,
        label: this.label,
        status: "disabled",
        mode: "disabled",
        requiresApiKey: false,
        envKeys: this.envKeys,
        baseUrl: env.STF_BASE_URL,
        rateLimitPerMinute: env.STF_RATE_LIMIT_PER_MINUTE,
      };
    }
    return {
      id: CorpusProvider.STF,
      label: this.label,
      status: "ok",
      mode: env.STF_PROVIDER_MODE,
      requiresApiKey: false,
      envKeys: this.envKeys,
      baseUrl: env.STF_BASE_URL,
      rateLimitPerMinute: env.STF_RATE_LIMIT_PER_MINUTE,
    };
  },
  factory() {
    const env = getEnv();
    if (!bool(env.ENABLE_STF_PROVIDER)) {
      throw new Error("STF provider está disabled");
    }
    if (env.STF_PROVIDER_MODE === "fixture") return fixtureProvider();
    return new StfCorpusProvider();
  },
};

const STJ_ENTRY: CorpusProviderEntry = {
  id: CorpusProvider.STJ,
  label: "STJ (súmulas + jurisprudência via SCON)",
  priority: 70,
  requiresApiKey: false,
  envKeys: ["STJ_BASE_URL", "STJ_PROVIDER_MODE", "ENABLE_STJ_PROVIDER"],
  sourceKind: "jurisprudence",
  status(): CorpusProviderStatus {
    const env = getEnv();
    if (!bool(env.ENABLE_STJ_PROVIDER)) {
      return {
        id: CorpusProvider.STJ,
        label: this.label,
        status: "disabled",
        mode: "disabled",
        requiresApiKey: false,
        envKeys: this.envKeys,
        baseUrl: env.STJ_BASE_URL,
        rateLimitPerMinute: env.STJ_RATE_LIMIT_PER_MINUTE,
      };
    }
    return {
      id: CorpusProvider.STJ,
      label: this.label,
      status: "ok",
      mode: env.STJ_PROVIDER_MODE,
      requiresApiKey: false,
      envKeys: this.envKeys,
      baseUrl: env.STJ_BASE_URL,
      rateLimitPerMinute: env.STJ_RATE_LIMIT_PER_MINUTE,
    };
  },
  factory() {
    const env = getEnv();
    if (!bool(env.ENABLE_STJ_PROVIDER)) {
      throw new Error("STJ provider está disabled");
    }
    if (env.STJ_PROVIDER_MODE === "fixture") return fixtureProvider();
    return new StjCorpusProvider();
  },
};

const DATAJUD_ENTRY: CorpusProviderEntry = {
  id: CorpusProvider.DATAJUD,
  label: "DataJud (CNJ — movimentações processuais)",
  priority: 90,
  requiresApiKey: true,
  envKeys: [
    "DATAJUD_BASE_URL",
    "DATAJUD_API_KEY",
    "DATAJUD_ALIAS",
    "DATAJUD_PROVIDER_MODE",
    "ENABLE_DATAJUD",
  ],
  sourceKind: "process_metadata",
  status(): CorpusProviderStatus {
    const env = getEnv();
    const enabled = bool(env.ENABLE_DATAJUD);
    const hasKey = (env.DATAJUD_API_KEY || "").trim().length > 0;
    const hasAlias = (env.DATAJUD_ALIAS || "").trim().length > 0;

    if (!enabled || env.DATAJUD_PROVIDER_MODE === "disabled") {
      return {
        id: CorpusProvider.DATAJUD,
        label: this.label,
        status: "disabled",
        mode: "disabled",
        requiresApiKey: true,
        envKeys: this.envKeys,
        baseUrl: env.DATAJUD_BASE_URL,
        rateLimitPerMinute: env.DATAJUD_RATE_LIMIT_PER_MINUTE,
        hint: "Defina ENABLE_DATAJUD=true e DATAJUD_PROVIDER_MODE=live para ativar.",
      };
    }
    if (!hasKey || !hasAlias) {
      const missing: string[] = [];
      if (!hasKey) missing.push("DATAJUD_API_KEY");
      if (!hasAlias) missing.push("DATAJUD_ALIAS");
      return {
        id: CorpusProvider.DATAJUD,
        label: this.label,
        status: "not_configured",
        mode: env.DATAJUD_PROVIDER_MODE,
        requiresApiKey: true,
        envKeys: this.envKeys,
        baseUrl: env.DATAJUD_BASE_URL,
        rateLimitPerMinute: env.DATAJUD_RATE_LIMIT_PER_MINUTE,
        detail: `Faltando: ${missing.join(", ")}`,
        hint: "Solicite a chave em https://datajud-wiki.cnj.jus.br/api-publica/acesso e defina DATAJUD_API_KEY + DATAJUD_ALIAS.",
      };
    }
    return {
      id: CorpusProvider.DATAJUD,
      label: this.label,
      status: "ok",
      mode: env.DATAJUD_PROVIDER_MODE,
      requiresApiKey: true,
      envKeys: this.envKeys,
      baseUrl: env.DATAJUD_BASE_URL,
      rateLimitPerMinute: env.DATAJUD_RATE_LIMIT_PER_MINUTE,
    };
  },
  factory() {
    const env = getEnv();
    if (!bool(env.ENABLE_DATAJUD) || env.DATAJUD_PROVIDER_MODE === "disabled") {
      throw new Error("DataJud provider está disabled");
    }
    if (env.DATAJUD_PROVIDER_MODE === "fixture") return fixtureProvider();
    if (!env.DATAJUD_API_KEY || !env.DATAJUD_ALIAS) {
      throw new Error(
        "DATAJUD_API_KEY ou DATAJUD_ALIAS ausentes — provider not_configured.",
      );
    }
    return new DatajudCorpusProvider({
      alias: env.DATAJUD_ALIAS,
      apiKey: env.DATAJUD_API_KEY,
      baseUrl: env.DATAJUD_BASE_URL,
    });
  },
};

const REGISTRY: Record<CorpusProvider, CorpusProviderEntry | undefined> = {
  FIXTURE: FIXTURE_ENTRY,
  LEXML: LEXML_ENTRY,
  STF: STF_ENTRY,
  STJ: STJ_ENTRY,
  DATAJUD: DATAJUD_ENTRY,
  TST: undefined,
  PLANALTO: undefined,
  MANUAL: undefined,
};

/** Lista entradas conhecidas, ordenadas por prioridade desc. */
export function listProviderEntries(): CorpusProviderEntry[] {
  return Object.values(REGISTRY)
    .filter((e): e is CorpusProviderEntry => Boolean(e))
    .sort((a, b) => b.priority - a.priority);
}

/** Retorna a entrada do registry, ou null se não há suporte. */
export function getProviderEntry(
  id: CorpusProvider,
): CorpusProviderEntry | null {
  return REGISTRY[id] ?? null;
}

/** Snapshot agregado para /api/admin/corpus-stats e logs de boot. */
export function snapshotProviderStatuses(): CorpusProviderStatus[] {
  return listProviderEntries().map((e) => e.status());
}

/**
 * Resolve um provider por id usando o registry. Lança erro com mensagem
 * acionável (mesma mensagem usada pelos scripts CLI).
 */
export function resolveProvider(id: CorpusProvider): CorpusProviderClient {
  const entry = REGISTRY[id];
  if (!entry) {
    throw new Error(
      `Provider ${id} não está registrado. Veja src/lib/corpus/providers/registry.ts.`,
    );
  }
  return entry.factory();
}
