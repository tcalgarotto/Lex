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

  it("filtra LegalChunk via legalChunkProductionWhere() (relação norm)", () => {
    expect(ROUTE_SRC).toMatch(/legalChunkProductionWhere\(/);
  });

  it("não importa mais a tabela legacy LegalSource (corpus canônico)", () => {
    // Apenas usos reais (Prisma model, raw SQL, helper). Comentários ainda
    // podem mencionar `LegalSource` ao explicar o reset canônico.
    expect(ROUTE_SRC).not.toMatch(/prisma\.legalSource\b/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionWhere\(/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionRawSql\(/);
    expect(ROUTE_SRC).not.toMatch(/from\s+["']LegalSource["']/);
  });

  it("valida cada hit com isProductionVisibleSource antes de renderizar", () => {
    expect(ROUTE_SRC).toMatch(/isProductionVisibleSource\(/);
  });

  it("usa shouldBypassDemoVisibility para decidir bypass (?all=1, /demo, dev)", () => {
    expect(ROUTE_SRC).toMatch(/shouldBypassDemoVisibility\(/);
  });

  it("define MIN_CHUNK_CHARS para filtrar chunks muito curtos", () => {
    expect(ROUTE_SRC).toMatch(/MIN_CHUNK_CHARS\s*=\s*\d+/);
  });
});
