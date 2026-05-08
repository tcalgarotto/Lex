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
 *
 * Segurança:
 *   - `meta` sempre passa por `scrubSecrets()` antes de virar string.
 *   - chaves sensíveis (token, password, key, cookie, cpf, email...) são
 *     mascaradas com `***`.
 *   - URLs são reescritas para esconder password embutida.
 *   - JWTs detectados em strings também são mascarados.
 *   - Auditável via teste em `logger.test.ts`.
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

// ---------------------------------------------------------------------------
// SECRET SCRUB
// ---------------------------------------------------------------------------

/**
 * Conjunto de tokens que, encontrados em qualquer profundidade do `meta`,
 * forçam o valor a ser mascarado. Match é case-insensitive contra a chave
 * inteira ou seus segmentos separados por `_`/`-`/`.`.
 */
const SENSITIVE_KEY_PATTERNS = [
  // segredos / credenciais
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /\btoken\b/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /\bauth(orization)?\b/i,
  /\bcookie\b/i,
  /set[_-]?cookie/i,
  /\bbearer\b/i,
  /\bjwt\b/i,
  /\bapi[_-]?key\b/i,
  /apikey/i,
  /service[_-]?role/i,
  /signing[_-]?key/i,
  /event[_-]?key/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /\bsalt\b/i,
  // PII brasileiro / contato
  /\bcpf\b/i,
  /\bcnpj\b/i,
  /\brg\b/i,
  /\boab\b/i,
  /\bemail\b/i,
  /\bphone\b/i,
  /\btelefone\b/i,
  /\bcelular\b/i,
];

const SENSITIVE_VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // JWT (3 segmentos base64)
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "***JWT***",
  },
  // chaves Bearer no header
  {
    pattern: /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi,
    replacement: "Bearer ***",
  },
  // password embutido em URL
  {
    pattern: /(?<=:\/\/[^/\s:]+:)[^@\s]+(?=@)/g,
    replacement: "***",
  },
  // chaves Postgres/Supabase/Stripe (detecções comuns)
  { pattern: /\bsk_[a-z0-9_]{16,}/gi, replacement: "***" },
  { pattern: /\beyJhbGciOi[A-Za-z0-9._-]{20,}/g, replacement: "***JWT***" },
];

const MAX_DEPTH = 6;
const MAX_STRING_LEN = 4_000;
const MASK = "***";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function scrubString(value: string): string {
  let out = value;
  for (const { pattern, replacement } of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  if (out.length > MAX_STRING_LEN) {
    out = `${out.slice(0, MAX_STRING_LEN)}…(truncated)`;
  }
  return out;
}

/**
 * Versão segura de qualquer valor para log. Mascara objetos profundamente,
 * trunca strings muito longas, e converte tipos opacos para representação
 * curta. Não lança em ciclos.
 */
export function scrubSecrets(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > MAX_DEPTH) return "[depth-limit]";
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return scrubString(input);
  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return input;
  }
  if (typeof input === "function") return "[function]";
  if (typeof input === "symbol") return input.toString();

  if (input instanceof Date) return input.toISOString();
  if (input instanceof Error) {
    return {
      name: input.name,
      message: scrubString(input.message),
      ...(input.stack ? { stack: scrubString(input.stack) } : {}),
    };
  }
  if (input instanceof URL) {
    return scrubString(input.toString());
  }
  if (Buffer.isBuffer(input as unknown as Buffer)) {
    return `[buffer ${(input as unknown as Buffer).length}B]`;
  }

  if (Array.isArray(input)) {
    if (seen.has(input as unknown as object)) return "[circular]";
    seen.add(input as unknown as object);
    return input.map((v) => scrubSecrets(v, depth + 1, seen));
  }

  if (typeof input === "object") {
    if (seen.has(input as object)) return "[circular]";
    seen.add(input as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = MASK;
        continue;
      }
      out[k] = scrubSecrets(v, depth + 1, seen);
    }
    return out;
  }

  return String(input);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return JSON.stringify(scrubSecrets(value));
    } catch {
      return "[unstringifiable]";
    }
  }
}

function fmt(scope: string, _level: Level, msg: string, meta?: Record<string, unknown>): string {
  const cleanMsg = scrubString(msg);
  const base = `[${scope}] ${cleanMsg}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  const cleanMeta = scrubSecrets(meta);
  return `${base} ${safeStringify(cleanMeta)}`;
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
