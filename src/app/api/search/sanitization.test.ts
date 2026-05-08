import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garantia estrutural de que os filtros anti-poluição estão presentes
 * no endpoint de busca. A intenção é que `STF-RE-DEMO`, `FIXTURE` e
 * chunks muito curtos sejam ocultados em produção.
 *
 * A regra de "o que é DEMO/FIXTURE" vive no helper canônico
 * `src/lib/corpus/source-visibility.ts`. Estes testes garantem que o
 * route consome o helper (em vez de filtros ad-hoc).
 */

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, "route.ts"),
  "utf-8",
);

describe("/api/search anti-pollution filters", () => {
  it("importa o helper canônico de source-visibility", () => {
    expect(ROUTE_SRC).toMatch(/from\s+["']@\/lib\/corpus\/source-visibility["']/);
  });

  it("usa DEMO_TOKEN_REGEX (regex centralizado) em vez de regex inline", () => {
    expect(ROUTE_SRC).toMatch(/DEMO_TOKEN_REGEX/);
  });

  it("delega corpus jurídico oficial ao retrieveLegalContext (hybrid + RRF)", () => {
    // Após o UX overhaul, o corpus legal não é mais consultado via
    // `prisma.legalChunk.findMany({ contains })`. Usamos
    // `retrieveLegalContext` que já injeta filtros multi-tenant e status
    // ACTIVE em `qdrant-corpus-filter.ts`.
    expect(ROUTE_SRC).toMatch(/retrieveLegalContext\(/);
    expect(ROUTE_SRC).toMatch(/from\s+["']@\/lib\/retrieval\/legal["']/);
  });

  it("não importa mais a tabela legacy LegalSource (corpus canônico)", () => {
    // Apenas usos reais (Prisma model, raw SQL, helper). Comentários ainda
    // podem mencionar `LegalSource` ao explicar o reset canônico.
    expect(ROUTE_SRC).not.toMatch(/prisma\.legalSource\b/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionWhere\(/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionRawSql\(/);
    expect(ROUTE_SRC).not.toMatch(/from\s+["']LegalSource["']/);
  });

  it("não consulta LegalChunk diretamente para a busca legal (foi para retrieveLegalContext)", () => {
    // A consulta ao corpus oficial passou a ser exclusivamente via
    // pipeline hybrid. `prisma.legalChunk.findMany` em /api/search seria
    // duplicação e burlaria os filtros do pipeline.
    expect(ROUTE_SRC).not.toMatch(/prisma\.legalChunk\.findMany/);
  });

  it("usa shouldBypassDemoVisibility para decidir bypass (?all=1, /demo, dev)", () => {
    expect(ROUTE_SRC).toMatch(/shouldBypassDemoVisibility\(/);
  });

  it("define MIN_CHUNK_CHARS para filtrar chunks muito curtos (caminho vetorial)", () => {
    expect(ROUTE_SRC).toMatch(/MIN_CHUNK_CHARS\s*=\s*\d+/);
  });
});
