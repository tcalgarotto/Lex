/**
 * Visibilidade de fontes jurídicas para a experiência normal de produção.
 *
 * Centraliza a regra "o que pode aparecer na busca/biblioteca em produção".
 * Tudo que é DEMO/FIXTURE/teste fica bloqueado da experiência normal e só
 * aparece em rotas demo explícitas (`/demo`) ou via flag de bypass.
 *
 * Toda página/rota que lista corpus jurídico OFICIAL deve usar este módulo
 * em vez de filtrar de forma ad-hoc — assim a regra é uma só.
 */

import { CorpusProvider, Prisma } from "@prisma/client";

/** Padrão case-insensitive para texto poluído (code, title, identifier). */
export const DEMO_PATTERNS = [
  "DEMO",
  "FIXTURE",
  "TESTE",
  "TEST",
  "EXEMPLO",
  "PLACEHOLDER",
] as const;

/** Padrão específico legacy. Vale tanto pra `code` quanto pra `sourceCode` no Qdrant. */
export const LEGACY_DEMO_CODES = [
  "STF-RE-DEMO",
  "STJ-RESP-DEMO",
  "STJ-AGR-DEMO",
] as const;

const ALL_DEMO_TOKENS = [...DEMO_PATTERNS, ...LEGACY_DEMO_CODES];

/** Regex montado a partir dos tokens acima — case-insensitive, palavra. */
export const DEMO_TOKEN_REGEX = new RegExp(
  `(${ALL_DEMO_TOKENS.map((t) => t.replace(/[-]/g, "\\-")).join("|")})`,
  "i",
);

/**
 * Tags consideradas "não-produção". Se uma fonte tem qualquer uma dessas tags,
 * fica fora da experiência normal.
 */
export const DEMO_TAGS = ["demo", "fixture", "test", "teste", "placeholder"] as const;

/**
 * `true` quando a fonte deve aparecer na experiência normal de produção.
 * Use em mapeamentos depois do fetch (quando você já tem o objeto na mão).
 *
 * Para filtrar antes do fetch (no nível do Prisma), use os builders
 * `legalSourceProductionWhere()` / `legalNormProductionWhere()`.
 */
export function isProductionVisibleSource(input: {
  code?: string | null;
  title?: string | null;
  identifier?: string | null;
  sourceProvider?: CorpusProvider | null;
  tags?: string[] | null;
}): boolean {
  if (input.sourceProvider === CorpusProvider.FIXTURE) return false;

  for (const field of [input.code, input.title, input.identifier]) {
    if (field && DEMO_TOKEN_REGEX.test(field)) return false;
  }

  if (input.tags && input.tags.length > 0) {
    const lower = input.tags.map((t) => t.toLowerCase());
    if (DEMO_TAGS.some((t) => lower.includes(t))) return false;
  }

  return true;
}

/**
 * Builder de `Prisma.LegalSourceWhereInput` que esconde DEMO/FIXTURE em
 * produção. `LegalSource` é a tabela legacy (não tem `sourceProvider` nem
 * `tags`); a regra é puramente sobre `code` e `title`.
 *
 * Detalhe Prisma: `mode: "insensitive"` não funciona dentro de
 * `{ field: { not: { contains } } }`. Tem que ser `NOT: { field: { contains, mode } }`
 * no nível superior do filter.
 */
export function legalSourceProductionWhere(): Prisma.LegalSourceWhereInput {
  return {
    AND: ALL_DEMO_TOKENS.map<Prisma.LegalSourceWhereInput>((token) => ({
      NOT: { code: { contains: token, mode: "insensitive" } },
    })),
  };
}

/**
 * Versão raw-SQL do filtro acima — para uso em `prisma.$queryRaw`.
 * Retorna fragmento SQL que pode ser interpolado com `Prisma.sql`.
 *
 * Exemplo:
 *   prisma.$queryRaw`SELECT * FROM "LegalSource" WHERE code ILIKE ${q}
 *                    AND ${legalSourceProductionRawSql()}`
 */
export function legalSourceProductionRawSql(): Prisma.Sql {
  const clauses = ALL_DEMO_TOKENS.map((token) => Prisma.sql`code NOT ILIKE ${"%" + token + "%"}`);
  return Prisma.join(clauses, " AND ");
}

/**
 * Builder de `Prisma.LegalNormWhereInput` que esconde corpus FIXTURE
 * (e qualquer LegalNorm com identifier/title contendo DEMO/FIXTURE) em
 * produção. Aplicar a `prisma.legalNorm.findMany` quando listar corpus.
 */
export function legalNormProductionWhere(): Prisma.LegalNormWhereInput {
  return {
    AND: [
      { sourceProvider: { not: CorpusProvider.FIXTURE } },
      ...ALL_DEMO_TOKENS.flatMap<Prisma.LegalNormWhereInput>((token) => [
        { NOT: { identifier: { contains: token, mode: "insensitive" } } },
        { NOT: { title: { contains: token, mode: "insensitive" } } },
      ]),
    ],
  };
}

/**
 * Builder de `Prisma.LegalChunkWhereInput` análogo — encadeia o filtro pelo
 * relacionamento `norm`.
 */
export function legalChunkProductionWhere(): Prisma.LegalChunkWhereInput {
  return {
    norm: legalNormProductionWhere(),
  };
}

/**
 * Decide se a request atual pode ver fontes demo. Use em rotas API e em RSC
 * (Server Component). Cenários:
 *   - `?all=1` na query string (debug/admin)
 *   - request veio da rota `/demo/...` (página explícita de demo)
 *   - `NODE_ENV !== production` (dev/preview)
 */
export function shouldBypassDemoVisibility(opts: {
  searchParams?: URLSearchParams | { all?: string | null } | null;
  pathname?: string | null;
  isProduction?: boolean;
}): boolean {
  if (opts.isProduction === false) return true;
  const all =
    opts.searchParams instanceof URLSearchParams
      ? opts.searchParams.get("all")
      : opts.searchParams?.all ?? null;
  if (all === "1") return true;
  if (opts.pathname?.startsWith("/demo")) return true;
  return false;
}
