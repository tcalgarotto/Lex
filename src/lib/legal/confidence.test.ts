import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "@/lib/retrieval/types";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";
import { evaluateSourceSufficiency } from "@/lib/legal/source-sufficiency";
import { computeConfidence } from "@/lib/legal/confidence";

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

describe("computeConfidence", () => {
  it("baixa quando insuficiente", () => {
    const classification = classifyLegalQuery("Qual prazo eu tenho para responder?");
    const sourceSufficiency = evaluateSourceSufficiency({ classification, retrievedChunks: [] });
    const c = computeConfidence({ classification, retrievedChunks: [], sourceSufficiency });
    expect(c.label).toBe("Baixa");
    expect(c.score).toBeLessThan(0.3);
  });

  it("alta com documento + legislação + múltiplas fontes", () => {
    const classification = classifyLegalQuery("O que devo fazer diante deste despacho?");
    const retrievedChunks = [
      chunk({ sourceType: "process_document", layer: "user_documents", score: 0.82 }),
      chunk({ sourceType: "legislation", layer: "legislation", score: 0.76 }),
      chunk({ sourceType: "process_memory", layer: "process_memory", score: null }),
    ];
    const sourceSufficiency = evaluateSourceSufficiency({ classification, retrievedChunks });
    const c = computeConfidence({ classification, retrievedChunks, sourceSufficiency });
    expect(["Alta", "Média"]).toContain(c.label);
    expect(c.score).toBeGreaterThan(0.5);
  });

  it("média com pouca diversidade", () => {
    const classification = classifyLegalQuery("Resuma o despacho");
    const retrievedChunks = [
      chunk({ sourceType: "process_document", layer: "user_documents", score: 0.7 }),
    ];
    const sourceSufficiency = evaluateSourceSufficiency({ classification, retrievedChunks });
    const c = computeConfidence({ classification, retrievedChunks, sourceSufficiency });
    expect(["Média", "Baixa"]).toContain(c.label);
  });
});

