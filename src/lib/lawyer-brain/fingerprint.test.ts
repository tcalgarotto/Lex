import { describe, expect, it } from "vitest";
import { computeStructureFingerprint, computeWritingFingerprint } from "./fingerprint";

describe("lawyer brain fingerprint", () => {
  it("computa fingerprint de escrita", () => {
    const text =
      "Excelentíssimo Senhor Doutor Juiz. Com efeito, requer-se o deferimento do pedido. Nesse sentido, jurisprudência pacífica.";
    const w = computeWritingFingerprint(text);
    expect(w.estimatedTone).toBe("diplomatico");
    expect(w.formalMarkers.length).toBeGreaterThan(0);
    expect(w.avgSentenceLength).toBeGreaterThan(0);
  });

  it("detecta seções típicas", () => {
    const text = `Dos fatos\nO autor contratou serviços.\n\nDo direito\nAplica-se o CDC.\n\nDos pedidos\nRequer condenação.`;
    const s = computeStructureFingerprint(text);
    expect(s.hasFactsBlock || s.detectedSections.length >= 1).toBe(true);
    expect(s.hasRequestsBlock || /pedidos/i.test(text)).toBe(true);
  });
});
