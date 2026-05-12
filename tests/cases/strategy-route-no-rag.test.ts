import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const strategyRoutePath = join(process.cwd(), "src/app/api/cases/[id]/strategy/route.ts");

describe("POST /api/cases/[id]/strategy", () => {
  it("não importa retrieveLegalContext (fluxo principal sem RAG)", () => {
    const src = readFileSync(strategyRoutePath, "utf-8");
    expect(src).not.toMatch(/retrieveLegalContext/);
    expect(src).toMatch(/generateStrategy/);
  });
});
