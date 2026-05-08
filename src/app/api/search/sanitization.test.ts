import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garantia estrutural de que os filtros anti-poluição estão presentes
 * no endpoint de busca. A intenção é que `STF-RE-DEMO`, `FIXTURE` e
 * chunks muito curtos sejam ocultados em produção.
 */

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, "route.ts"),
  "utf-8",
);

describe("/api/search anti-pollution filters", () => {
  it("contém regex que captura DEMO/FIXTURE/EXEMPLO", () => {
    expect(ROUTE_SRC).toMatch(/DEMO\|FIXTURE\|TEST\(E\)\?\|EXEMPLO/);
  });

  it("contém regex que captura STF-RE-DEMO-N", () => {
    expect(ROUTE_SRC).toMatch(/STF-RE-DEMO\|RE-DEMO/);
  });

  it("filtra LegalSource demo em produção via where clause", () => {
    expect(ROUTE_SRC).toMatch(/IS_PROD/);
    expect(ROUTE_SRC).toMatch(/NOT:\s*\{\s*code:\s*\{\s*contains:\s*"DEMO"/);
  });

  it("descarta LegalChunk de FIXTURE quando showAll=false", () => {
    expect(ROUTE_SRC).toMatch(/sourceProvider:\s*\{\s*not:\s*CorpusProvider\.FIXTURE\s*\}/);
  });

  it("define MIN_CHUNK_CHARS para filtrar chunks muito curtos", () => {
    expect(ROUTE_SRC).toMatch(/MIN_CHUNK_CHARS\s*=\s*\d+/);
  });
});
