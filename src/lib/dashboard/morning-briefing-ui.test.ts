import { describe, expect, it } from "vitest";
import { DASHBOARD_FORBIDDEN_METHOD_TERMS, DASHBOARD_HOME_UI_COPY } from "@/components/dashboard/morning-briefing";
import {
  type BriefingActionItem,
  formatLawyerGreetingFirstName,
  lawyerHonorificFromMetadata,
} from "./morning-briefing-data";

function bucketOf(a: BriefingActionItem) {
  return a.eisenhowerBucket ?? "maximum";
}

describe("morning briefing UI helpers", () => {
  it("defaults missing Eisenhower bucket to maximum", () => {
    const a: BriefingActionItem = {
      id: "x",
      type: "caso",
      title: "Teste",
      reason: "Motivo",
      cta: "Abrir",
      href: "/cases",
      priority: "normal",
    };
    expect(bucketOf(a)).toBe("maximum");
  });

  it("keeps user-visible copy free of infra jargon", () => {
    const forbidden = /\b(RAG|Qdrant|chunk|embedding|pipeline|workspace)\b/i;
    const samples = [
      "Sem entrevista completa, o Lex não consegue organizar fatos, partes e pedidos.",
      "Fluxo de documentos",
      "Pesquisa Lex AI",
      "Coleta inicial",
    ];
    for (const s of samples) {
      expect(s).not.toMatch(forbidden);
    }
  });

  it("planejamento da semana copy omits method-management jargon", () => {
    for (const value of Object.values(DASHBOARD_HOME_UI_COPY)) {
      const lower = value.toLowerCase();
      for (const term of DASHBOARD_FORBIDDEN_METHOD_TERMS) {
        expect(lower.includes(term.toLowerCase())).toBe(false);
      }
    }
  });

  it("exposes planejamento da semana title for regression", () => {
    expect(DASHBOARD_HOME_UI_COPY.planejamentoSemanaTitulo).toBe("Planejamento da semana");
  });

  it("capitalizes first name for greeting", () => {
    expect(formatLawyerGreetingFirstName("thales")).toBe("Thales");
    expect(formatLawyerGreetingFirstName("MARIA")).toBe("Maria");
    expect(formatLawyerGreetingFirstName("  joão  ")).toBe("João");
  });

  it("picks honorific from metadata when available", () => {
    expect(lawyerHonorificFromMetadata({ gender: "female" })).toBe("Dra.");
    expect(lawyerHonorificFromMetadata({ genero: "Feminino" })).toBe("Dra.");
    expect(lawyerHonorificFromMetadata({ gender: "male" })).toBe("Dr.");
    expect(lawyerHonorificFromMetadata({})).toBe("Dr.");
  });
});
