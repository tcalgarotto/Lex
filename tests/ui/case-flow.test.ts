import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_SUBNAV_ITEMS } from "@/components/cases/case-subnav";
import {
  CASE_COCKPIT_SEGMENTS,
  CASE_CTA_FORBIDDEN_HREF_PATTERNS,
  caseCockpitHref,
  caseProcessImportHref,
} from "@/lib/cases/case-cockpit-routes";
import { USER_FACING_MESSAGES } from "@/lib/ui/product-terminology";

const FORBIDDEN = [
  "embedding",
  "chunk",
  "Qdrant",
  "rerank",
  "vector",
  "pipeline",
] as const;

const ROOT = join(process.cwd(), "src/components/cases");

function readCaseComponent(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("case flow UX (subnav + copy)", () => {
  it("lists the eight case sections in the canonical order", () => {
    expect(CASE_SUBNAV_ITEMS.map((i) => i.label)).toEqual([
      "Visão geral",
      "Entrevista",
      "Fatos e partes",
      "Documentos",
      "Pesquisa jurídica",
      "Estratégia",
      "Peças e minutas",
      "Processo vinculado",
    ]);
  });

  it("does not expose forbidden dev jargon in user-facing terminology strings", () => {
    const haystack = [
      USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP,
      USER_FACING_MESSAGES.AI_RESULT_REVIEW,
      USER_FACING_MESSAGES.JURISPRUDENCE_CONFIRM,
      USER_FACING_MESSAGES.GLOBAL_RESEARCH_EMPTY,
      USER_FACING_MESSAGES.FOUNDATION_REQUIRES_PIN,
    ].join("\n");
    for (const term of FORBIDDEN) {
      expect(haystack.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});

describe("case cockpit routes (Fase 2)", () => {
  const caseId = "case_test_01";

  it("builds in-case hrefs for all cockpit segments", () => {
    expect(caseCockpitHref(caseId, "pesquisa")).toBe(`/cases/${caseId}/pesquisa-juridica`);
    expect(caseCockpitHref(caseId, "estrategia")).toBe(`/cases/${caseId}/estrategia`);
    expect(caseCockpitHref(caseId, "pecas")).toBe(`/cases/${caseId}/pecas`);
    expect(caseCockpitHref(caseId, "processo")).toBe(`/cases/${caseId}/processo`);
    expect(caseCockpitHref(caseId, "pesquisa", { q: "danos morais" })).toBe(
      `/cases/${caseId}/pesquisa-juridica?q=danos+morais`,
    );
  });

  it("process import keeps returnCase on external processos route", () => {
    expect(caseProcessImportHref(caseId)).toBe(`/processos?returnCase=${caseId}`);
  });

  it("exposes all segment paths under /cases/[id]", () => {
    for (const suffix of Object.values(CASE_COCKPIT_SEGMENTS)) {
      if (suffix === "") continue;
      expect(suffix.startsWith("/")).toBe(true);
      expect(suffix.includes("/cases/")).toBe(false);
    }
  });
});

describe("case overview CTAs stay in-case", () => {
  const overviewSrc = readCaseComponent("case-overview-tab.tsx");

  it("overview primary buttons link to case routes only", () => {
    expect(overviewSrc).toContain("pesquisa-juridica");
    expect(overviewSrc).toContain("/cases/${c.id}/estrategia");
    expect(overviewSrc).toContain("/cases/${c.id}/pecas");
    expect(overviewSrc).toContain("/cases/${c.id}/processo");
    for (const pattern of CASE_CTA_FORBIDDEN_HREF_PATTERNS) {
      expect(overviewSrc).not.toMatch(pattern);
    }
  });
});

describe("case documents delete affordance", () => {
  const docsSrc = readCaseComponent("case-documents-tab.tsx");

  it("shows visible Excluir label and accessible name", () => {
    expect(docsSrc).toContain('aria-label={`Excluir documento ${d.originalName}`}');
    expect(docsSrc).toContain("title=\"Excluir documento permanentemente\"");
    expect(docsSrc).toMatch(/<span>Excluir<\/span>/);
    expect(docsSrc).toContain("method: \"DELETE\"");
  });
});

describe("case copilot shortcuts", () => {
  const copilotSrc = readCaseComponent("case-copilot-panel.tsx");

  it("does not link to global strategy or pesquisa", () => {
    expect(copilotSrc).toContain("/cases/${c.id}/processo");
    for (const pattern of CASE_CTA_FORBIDDEN_HREF_PATTERNS) {
      expect(copilotSrc).not.toMatch(pattern);
    }
  });
});
