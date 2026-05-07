/**
 * Logger leve, sem dependências, controlado por `LOG_LEVEL`.
 *
 * Níveis (do mais ao menos verboso): `debug` < `info` < `warn` < `error`.
 *
 * Default em produção: `info`. Em dev/test: `warn` (reduz ruído sem perder erros).
 *
 * Inclui `warnOnce(key, message)` para alertas que se repetem em loop
 * (Redis offline, Qdrant offline, env faltando) — log apenas a 1ª vez por
 * processo, depois conta silenciosamente.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): Level {
  const raw = (process.env["LOG_LEVEL"] ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  if (process.env["NODE_ENV"] === "production") return "info";
  return "warn";
}

let currentLevel = resolveLevel();

export function setLogLevel(level: Level): void {
  currentLevel = level;
}

function shouldLog(level: Level): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

const seen = new Map<string, { firstAt: number; count: number }>();

export type Logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  /** Log a primeira ocorrência; depois apenas incrementa contador silencioso. */
  warnOnce: (key: string, msg: string, meta?: Record<string, unknown>) => void;
  /** Variante de `warnOnce` para erros recorrentes (loop infinito). */
  errorOnce: (key: string, msg: string, meta?: Record<string, unknown>) => void;
};

function fmt(scope: string, level: Level, msg: string, meta?: Record<string, unknown>): string {
  const base = `[${scope}] ${msg}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

export function getLogger(scope: string): Logger {
  const log = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;
    const line = fmt(scope, level, msg, meta);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (level === "info") console.info(line);
    else console.debug(line);
  };
  return {
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    warnOnce: (key, m, meta) => {
      const k = `${scope}:${key}`;
      const prev = seen.get(k);
      if (prev) {
        prev.count += 1;
        return;
      }
      seen.set(k, { firstAt: Date.now(), count: 1 });
      log("warn", m, meta);
    },
    errorOnce: (key, m, meta) => {
      const k = `${scope}:${key}`;
      const prev = seen.get(k);
      if (prev) {
        prev.count += 1;
        return;
      }
      seen.set(k, { firstAt: Date.now(), count: 1 });
      log("error", m, meta);
    },
  };
}

/** Métricas internas (test/inspeção). */
export function _logCounters(): Map<string, { firstAt: number; count: number }> {
  return seen;
}

export function _resetLogCounters(): void {
  seen.clear();
}
