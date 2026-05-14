import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Teste estrutural: garante que as defesas de segurança críticas
 * permanecem no middleware. Se alguém remover sem querer, o teste falha.
 */
const SRC = fs.readFileSync(path.resolve(__dirname, "proxy.ts"), "utf-8");

describe("middleware security guards", () => {
  it("bloqueia mutações cross-origin (CSRF guard)", () => {
    expect(SRC).toMatch(/cross-origin blocked/);
    expect(SRC).toMatch(/status:\s*403/);
    expect(SRC).toMatch(/originHost\s*!==\s*url\.host/);
  });

  it("isenta apenas webhooks que usam assinatura própria", () => {
    expect(SRC).toMatch(/\/api\/inngest/);
    expect(SRC).toMatch(/\/api\/stripe\/webhook/);
  });

  it("aplica CSP", () => {
    expect(SRC).toMatch(/Content-Security-Policy/);
    expect(SRC).toMatch(/frame-ancestors\s+'none'/);
  });

  it("aplica HSTS apenas em produção", () => {
    expect(SRC).toMatch(/Strict-Transport-Security/);
    expect(SRC).toMatch(/max-age=63072000/);
  });

  it("exige auth em /api/* (exceto webhooks/health)", () => {
    expect(SRC).toMatch(/SESSION_REQUIRED/);
    expect(SRC).toMatch(/getSession/);
    expect(SRC).toMatch(/isPublicApi/);
    expect(SRC).toMatch(/response\.cookies\.getAll/);
  });
});
