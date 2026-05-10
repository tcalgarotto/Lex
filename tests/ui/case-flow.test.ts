import { describe, expect, it } from "vitest";
import { CASE_SUBNAV_ITEMS } from "@/components/cases/case-subnav";
import {
  USER_FACING_MESSAGES,
} from "@/lib/ui/product-terminology";

const FORBIDDEN = [
  "embedding",
  "chunk",
  "Qdrant",
  "rerank",
  "vector",
  "RAG",
  "fallback",
  "pipeline",
] as const;

describe("case flow UX (subnav + copy)", () => {
  it("lists the six case sections in the canonical order", () => {
    expect(CASE_SUBNAV_ITEMS.map((i) => i.label)).toEqual([
      "Visão geral",
      "Entrevista guiada",
      "Partes e fatos",
      "Documentos",
      "Pesquisa jurídica",
      "Estratégia e peças",
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
