import { describe, expect, it } from "vitest";
import { groundingFromChunks, PROMPT_VERSION, SYSTEM_BASE } from "@/lib/ai/prompts";
import type { RetrievedChunk } from "@/lib/retrieval/hybrid-retriever";

describe("prompts", () => {
  it("exports version", () => {
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });

  it("SYSTEM_BASE mentions JustOS and fontes", () => {
    expect(SYSTEM_BASE).toContain("JustOS");
    expect(SYSTEM_BASE).toContain("FONTES");
  });

  it("groundingFromChunks numbers sources", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "1",
        text: "Art. 5º Todos são iguais.",
        layer: "legislation",
        sourceType: "legislation",
        sourceLabel: "CF",
        score: 0.9,
        meta: { articleRef: "Art. 5º" },
      },
    ];
    const g = groundingFromChunks(chunks);
    expect(g).toContain("[fonte:1]");
    expect(g).toContain("Art. 5º");
  });
});
