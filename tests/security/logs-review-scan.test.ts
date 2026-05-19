/**
 * Testes do scanner estático de logs (fixtures locais).
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { exitCodeFor, scanDirectory, summarize } from "../../scripts/security-audit/logs-review-scan";

const FIXTURES = resolve(process.cwd(), "tests/fixtures/logs-review");
const SRC = resolve(process.cwd(), "src");

describe("logs-review-scan", () => {
  it("LR-SCAN.1 fixture segura — sem P0/P1", () => {
    const findings = scanDirectory(FIXTURES);
    const s = summarize(findings.filter((f) => f.file.endsWith("safe-logging.ts")));
    expect(s.bySeverity.P0).toBe(0);
    expect(s.bySeverity.P1).toBe(0);
  });

  it("LR-SCAN.2 fixture P0 — detecta service_role", () => {
    const findings = scanDirectory(FIXTURES).filter((f) => f.file.includes("unsafe-p0"));
    expect(findings.some((f) => f.severity === "P0" && f.pattern === "service_role")).toBe(true);
  });

  it("LR-SCAN.3 fixture P1 — detecta extractedText", () => {
    const findings = scanDirectory(FIXTURES).filter((f) => f.file.includes("unsafe-p1-logging"));
    expect(findings.some((f) => f.severity === "P1" && f.pattern === "document_text")).toBe(true);
  });

  it("LR-SCAN.4 fixture multiline — P1 na janela após log.error", () => {
    const findings = scanDirectory(FIXTURES).filter((f) => f.file.includes("multiline"));
    expect(findings.some((f) => f.severity === "P1")).toBe(true);
  });

  it("LR-SCAN.5 src/ — P0 e P1 devem ser zero", () => {
    const findings = scanDirectory(SRC);
    const s = summarize(findings);
    expect(s.bySeverity.P0).toBe(0);
    expect(s.bySeverity.P1).toBe(0);
  });

  it("LR-SCAN.6 exit code — falha em P1", () => {
    const findings = scanDirectory(FIXTURES);
    const s = summarize(findings);
    expect(exitCodeFor(s)).toBe(1);
  });

  it("LR-SCAN.7 fixture P2 — detecta PII parcial (warning)", () => {
    const findings = scanDirectory(FIXTURES).filter((f) => f.file.includes("unsafe-p2"));
    expect(findings.some((f) => f.severity === "P2")).toBe(true);
    const s = summarize(findings);
    expect(exitCodeFor(s)).toBe(0);
  });

  it("LR-SCAN.8 src/ — não varre tests/", () => {
    const findings = scanDirectory(SRC);
    expect(findings.every((f) => !f.file.includes("/tests/"))).toBe(true);
  });
});
