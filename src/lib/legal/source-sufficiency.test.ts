import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "@/lib/retrieval/types";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";
import { evaluateSourceSufficiency } from "@/lib/legal/source-sufficiency";

function chunk(partial: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: partial.id ?? "x",
    text: partial.text ?? "texto",
    layer: partial.layer ?? "process_memory",
    sourceType: partial.sourceType ?? "process_memory",
    sourceLabel: partial.sourceLabel ?? "memória",
    score: partial.score ?? null,
    meta: partial.meta ?? {},
  };
}

describe("evaluateSourceSufficiency", () => {
  it("sem fontes e pergunta forte => insuficiente", () => {
    const classification = classifyLegalQuery("Qual prazo eu tenho para responder?");
    const r = evaluateSourceSufficiency({ classification, retrievedChunks: [] });
    expect(r.sufficient).toBe(false);
    expect(r.level).toBe("low");
  });

  it("só memória quente => warning e no máximo medium", () => {
    const classification = classifyLegalQuery("O que devo fazer agora?");
    const r = evaluateSourceSufficiency({
      classification,
      retrievedChunks: [chunk({ sourceType: "process_memory", layer: "process_memory" })],
    });
    expect(r.sufficient).toBe(true);
    expect(["medium", "high"]).toContain(r.level);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("case_strategy contextual sem documento => insuficiente", () => {
    const classification = classifyLegalQuery("O que devo fazer diante desse despacho?");
    expect(classification.requiresProcessDocument).toBe(true);
    const r = evaluateSourceSufficiency({
      classification,
      retrievedChunks: [chunk({ sourceType: "process_memory", layer: "process_memory" })],
    });
    expect(r.sufficient).toBe(false);
    expect(r.level).toBe("low");
  });

  it("prazo com documento do processo => suficiente", () => {
    const classification = classifyLegalQuery("Qual prazo eu tenho para responder esse despacho?");
    const r = evaluateSourceSufficiency({
      classification,
      retrievedChunks: [
        chunk({
          sourceType: "process_document",
          layer: "user_documents",
          meta: { documentId: "doc1", section: "dispositive" },
        }),
      ],
    });
    expect(r.sufficient).toBe(true);
  });

  it("jurisprudência pedida mas ausente => insuficiente", () => {
    const classification = classifyLegalQuery("Me traga jurisprudência sobre isso");
    const r = evaluateSourceSufficiency({
      classification,
      retrievedChunks: [chunk({ sourceType: "legislation", layer: "legislation" })],
    });
    expect(r.sufficient).toBe(false);
  });

  it("base legal com legislação presente => suficiente", () => {
    const classification = classifyLegalQuery("Qual o fundamento legal?");
    const r = evaluateSourceSufficiency({
      classification,
      retrievedChunks: [chunk({ sourceType: "legislation", layer: "legislation" })],
    });
    expect(r.sufficient).toBe(true);
  });
});

