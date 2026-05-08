import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().url(),
    /** Conexão direta para Prisma migrations (Supabase pooler em modo session). */
    DIRECT_URL: z.string().url().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    /**
     * Service role key do Supabase. Necessária apenas para operações server-side privilegiadas
     * (upload/download de Storage via admin client). Login/signup/middleware funcionam sem ela.
     */
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
    /** Provedor de chat (expandir com adapters em `src/lib/ai/providers/`). */
    AI_CHAT_PROVIDER: z
      .enum(["deepseek", "openai", "anthropic", "openrouter"])
      .default("deepseek"),
    AI_MODEL_CHAT: z.string().optional(),
    AI_MODEL_COMPLETION: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    DEEPINFRA_API_KEY: z.string().optional().default(""),
    DEEPINFRA_BASE_URL: z.string().url().default("https://api.deepinfra.com/v1/openai"),
    QDRANT_URL: z.string().url(),
    /** Vazio em Qdrant local sem autenticação */
    QDRANT_API_KEY: z.string().optional().default(""),
    QDRANT_COLLECTION: z.string().default("lex_main"),
    /**
     * Redis. Opcional em dev (rate limit/cache caem para fail-open in-memory).
     * Em produção, `REDIS_REQUIRED=true` (default em prod) faz health virar
     * 503 quando Redis cai.
     */
    REDIS_URL: z.string().url().optional(),
    REDIS_REQUIRED: z
      .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
      .optional(),
    REDIS_NAMESPACE: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
    PRISMA_QUERY_LOGS: z
      .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
      .optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    STORAGE_BUCKET_DOCUMENTS: z.string().default("documents"),
    OCR_PROVIDER: z.enum(["tesseract", "mistral"]).default("tesseract"),
    MISTRAL_API_KEY: z.string().optional(),

    // ----------------------------------------------------------------
    // Provedores jurídicos públicos (corpus RAG).
    //
    // Modos suportados por provider:
    //   - `live`      → usa fonte real (HTTP) com rate-limit/timeout
    //   - `fixture`   → usa dataset embutido (zero rede)
    //   - `disabled`  → provider não pode ser invocado
    //
    // DataJud é especial: requer `DATAJUD_API_KEY`. Sem chave, fica em
    // estado `not_configured` (visível em /api/admin/corpus-stats e logs)
    // e qualquer chamada falha com NonRetriableError.
    // ----------------------------------------------------------------
    LEXML_BASE_URL: z.string().url().default("https://www.lexml.gov.br/busca/SRU"),
    LEXML_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    LEXML_DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).max(200).default(50),
    LEXML_MAX_PAGES_PER_SYNC: z.coerce.number().int().min(1).max(200).default(20),
    LEXML_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),

    STF_BASE_URL: z.string().url().default("https://portal.stf.jus.br"),
    STF_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    STF_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(10),

    STJ_BASE_URL: z.string().url().default("https://scon.stj.jus.br"),
    STJ_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    STJ_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(10),

    DATAJUD_BASE_URL: z
      .string()
      .url()
      .default("https://api-publica.datajud.cnj.jus.br"),
    DATAJUD_API_KEY: z.string().optional().default(""),
    DATAJUD_ALIAS: z.string().optional().default("api_publica_tjsp"),
    DATAJUD_PROVIDER_MODE: z
      .enum(["live", "fixture", "disabled"])
      .default("live"),
    DATAJUD_DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    DATAJUD_MAX_PAGES_PER_SYNC: z.coerce.number().int().min(1).max(100).default(10),
    DATAJUD_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(30),

    CAMARA_BASE_URL: z
      .string()
      .url()
      .default("https://dadosabertos.camara.leg.br/api/v2"),
    CAMARA_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    CAMARA_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(30),

    SENADO_BASE_URL: z
      .string()
      .url()
      .default("https://legis.senado.leg.br/dadosabertos"),
    SENADO_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    SENADO_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(30),

    PLANALTO_BASE_URL: z.string().url().default("https://www.planalto.gov.br"),
    PLANALTO_PROVIDER_MODE: z.enum(["live", "fixture", "disabled"]).default("live"),
    /** Rate limit conservador — Planalto é uma página por lei, max 15/sync. */
    PLANALTO_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(10),
    /** Timeout em ms para o GET do Planalto. */
    PLANALTO_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30_000),

    // Feature flags de retrieval/ingestion (production-grade defaults).
    ENABLE_CORPUS_SYNC: z.coerce.boolean().default(true),
    ENABLE_LEGAL_RETRIEVAL: z.coerce.boolean().default(true),
    ENABLE_CORPUS_GRAPH: z.coerce.boolean().default(true),
    ENABLE_LEXML_PROVIDER: z.coerce.boolean().default(true),
    ENABLE_STF_PROVIDER: z.coerce.boolean().default(true),
    ENABLE_STJ_PROVIDER: z.coerce.boolean().default(true),
    ENABLE_DATAJUD: z.coerce.boolean().default(true),
    ENABLE_CAMARA_PROVIDER: z.coerce.boolean().default(true),
    ENABLE_SENADO_PROVIDER: z.coerce.boolean().default(true),
    ENABLE_PLANALTO_PROVIDER: z.coerce.boolean().default(true),
    /**
     * ColBERT/multivector rerank — desabilitado por padrão.
     *
     * Quando `true`, requer collection `lex_corpus_norms_colbert` com
     * `multivector_config.comparator=max_sim` provisionada via pipeline
     * separado. Veja `docs/COLBERT_LEGAL_RETRIEVAL.md`.
     *
     * Flag NÃO ativa retrieval ColBERT por enquanto — apenas reserva o
     * espaço de configuração. Code path ainda não implementado.
     */
    LEGAL_COLBERT_ENABLED: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // Em produção exigimos a chave do provider configurado; em dev apenas avisamos.
    if (data.NODE_ENV !== "production") return;
    switch (data.AI_CHAT_PROVIDER) {
      case "deepseek":
        if (!data.DEEPSEEK_API_KEY?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "DEEPSEEK_API_KEY obrigatório quando AI_CHAT_PROVIDER=deepseek",
            path: ["DEEPSEEK_API_KEY"],
          });
        }
        break;
      case "openai":
        if (!data.OPENAI_API_KEY?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "OPENAI_API_KEY obrigatório quando AI_CHAT_PROVIDER=openai",
            path: ["OPENAI_API_KEY"],
          });
        }
        break;
      case "anthropic":
        if (!data.ANTHROPIC_API_KEY?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ANTHROPIC_API_KEY obrigatório quando AI_CHAT_PROVIDER=anthropic",
            path: ["ANTHROPIC_API_KEY"],
          });
        }
        break;
      case "openrouter":
        if (!data.OPENROUTER_API_KEY?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "OPENROUTER_API_KEY obrigatório quando AI_CHAT_PROVIDER=openrouter",
            path: ["OPENROUTER_API_KEY"],
          });
        }
        break;
      default:
        break;
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function formatEnvErrors(fieldErrors: Record<string, string[] | undefined>): string {
  const lines = Object.entries(fieldErrors)
    .filter(([, msgs]) => msgs && msgs.length > 0)
    .map(([key, msgs]) => `  - ${key}: ${(msgs ?? []).join("; ")}`);
  return lines.join("\n");
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = formatEnvErrors(parsed.error.flatten().fieldErrors);
    const msg = [
      "❌ Variáveis de ambiente inválidas:",
      formatted,
      "",
      "Confira o arquivo .env (e .env.example para referência).",
      "Em produção (Vercel), confira as Project Environment Variables.",
    ].join("\n");
    console.error(msg);
    throw new Error("Invalid environment variables");
  }
  cached = parsed.data;
  return cached;
}

/**
 * Validação leve no startup do servidor — chamado em `instrumentation.ts`.
 * Lê só o necessário para autenticação Supabase + banco; não trava o boot por
 * variáveis opcionais (apenas alerta).
 */
export function assertCriticalEnv(): void {
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    const hints: string[] = [];
    if (
      missing.includes("DATABASE_URL") &&
      process.env["POSTGRES_PRISMA_URL"]?.trim()
    ) {
      hints.push(
        "💡 POSTGRES_PRISMA_URL detectado — defina DATABASE_URL com o mesmo valor (ou deixe que `env-normalize` faça via fallback automático).",
      );
    }
    console.error(
      `❌ Variáveis críticas ausentes: ${missing.join(", ")}.\n` +
        (hints.length > 0 ? `${hints.join("\n")}\n` : "") +
        `Em produção (Vercel): Settings → Environment Variables (escopo Production) → Redeploy.\n` +
        `Em dev: crie/preencha o arquivo .env.`,
    );
    return;
  }

  const warnings: string[] = [];
  if (!process.env["DIRECT_URL"]?.trim()) {
    if (process.env["POSTGRES_URL_NON_POOLING"]?.trim()) {
      warnings.push(
        "⚠️  DIRECT_URL não definido — defina com o mesmo valor de POSTGRES_URL_NON_POOLING (ou deixe `env-normalize` aplicar fallback no boot).",
      );
    } else {
      warnings.push(
        "⚠️  DIRECT_URL não definido — Prisma migrate/seed pode falhar no Supabase. Defina o pooler em modo session (porta 5432).",
      );
    }
  }
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim()) {
    warnings.push(
      "⚠️  SUPABASE_SERVICE_ROLE_KEY não definido — uploads/downloads via Storage admin ficarão indisponíveis.",
    );
  }
  if (warnings.length > 0) {
    console.warn(warnings.join("\n"));
  }
}

/** Safe for client-only vars – server routes should use getEnv() */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
});

/**
 * Subconjunto de env exclusivo para clientes Supabase server-side (admin/storage).
 * Permite carregar admin client sem precisar que TODAS as envs (IA, Qdrant, Redis, etc.)
 * estejam preenchidas — útil para rotas isoladas e scripts.
 */
const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  STORAGE_BUCKET_DOCUMENTS: z.string().default("documents"),
});
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

let cachedSupabase: SupabaseEnv | null = null;
export function getSupabaseEnv(): SupabaseEnv {
  if (cachedSupabase) return cachedSupabase;
  const parsed = supabaseEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = formatEnvErrors(parsed.error.flatten().fieldErrors);
    console.error(`❌ Variáveis Supabase inválidas:\n${formatted}`);
    throw new Error("Invalid Supabase environment variables");
  }
  cachedSupabase = parsed.data;
  return cachedSupabase;
}
