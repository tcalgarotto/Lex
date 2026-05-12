import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garantias estruturais do endpoint `/api/search`: workspace em Postgres,
 * sugestões jurídicas via provedor configurado (DeepSeek), sem consulta
 * direta ao corpus chunkado nem ao pipeline legado de vetores.
 */

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, "route.ts"),
  "utf-8",
);

describe("/api/search (workspace + pesquisa assistida)", () => {
  it("usa o provedor de pesquisa jurídica (sem retrieveLegalContext na rota)", () => {
    expect(ROUTE_SRC).toMatch(/getLegalResearchProvider\(/);
    expect(ROUTE_SRC).not.toMatch(/retrieveLegalContext/);
  });

  it("não importa mais a tabela legacy LegalSource (corpus canônico)", () => {
    expect(ROUTE_SRC).not.toMatch(/prisma\.legalSource\b/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionWhere\(/);
    expect(ROUTE_SRC).not.toMatch(/legalSourceProductionRawSql\(/);
    expect(ROUTE_SRC).not.toMatch(/from\s+["']LegalSource["']/);
  });

  it("não consulta LegalChunk diretamente", () => {
    expect(ROUTE_SRC).not.toMatch(/prisma\.legalChunk\.findMany/);
  });

  it("expõe corpusSearchConfigMuted para o cliente degradar UX com segurança", () => {
    expect(ROUTE_SRC).toMatch(/corpusSearchConfigMuted/);
    expect(ROUTE_SRC).toMatch(/isAnyCorpusSearchConfigMuted/);
  });

  it("não expõe o tipo jargão 'vetorial' no payload", () => {
    expect(ROUTE_SRC).not.toMatch(/type:\s*["']vetorial["']/);
  });

  it("paraleliza workspace e jurídico (Promise.all)", () => {
    expect(ROUTE_SRC).toMatch(/Promise\.all\(/);
  });

  it("inclui href em hits jurídicos (pesquisa-jurídica)", () => {
    expect(ROUTE_SRC).toMatch(/\/pesquisa-juridica\?q=/);
  });

  it("inclui href para casos, processos, peças e documentos", () => {
    expect(ROUTE_SRC).toMatch(/\/cases\/\$\{/);
    expect(ROUTE_SRC).toMatch(/\/processos\/\$\{/);
    expect(ROUTE_SRC).toMatch(/\/editor\/\$\{/);
    expect(ROUTE_SRC).toMatch(/\/documentos/);
  });

  it("não expõe o tipo jargão 'vetorial' no payload", () => {
    expect(ROUTE_SRC).not.toMatch(/type:\s*["']vetorial["']/);
  });

  it("inclui href quando há origem (documento/processo/peça)", () => {
    // Garantia estrutural: hits de Qdrant (lex_main) devem ser navegáveis
    // para a origem (documento/processo/peça). Sem isso vira "trecho solto".
    expect(ROUTE_SRC).toMatch(/const href\s*=/);
    expect(ROUTE_SRC).toMatch(/processos\/\$\{/);
    expect(ROUTE_SRC).toMatch(/\/documentos/);
    expect(ROUTE_SRC).toMatch(/\/editor\/\$\{/);
  });
});
