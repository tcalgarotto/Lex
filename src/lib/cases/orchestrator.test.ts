import { describe, expect, it } from "vitest";
import { mapContradictionToCaseRisks } from "./orchestrator";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";

describe("mapContradictionToCaseRisks", () => {
  it("classifica norma revogada como REVOKED_NORM/HIGH", () => {
    const r: ContradictionRisk = {
      id: "x", severity: "alta", title: "Norma revogada", detail: "Foi expressamente revogada.", evidence: { chunkIds: [], normUrns: [] },
    };
    const out = mapContradictionToCaseRisks([r]);
    expect(out[0]!.kind).toBe("REVOKED_NORM");
    expect(out[0]!.severity).toBe("HIGH");
  });
  it("classifica divergência como PRECEDENT_DIVERGENCE", () => {
    const r: ContradictionRisk = {
      id: "x", severity: "media", title: "Tese diverge", detail: "STJ e STF possuem entendimentos diferentes.", evidence: { chunkIds: [], normUrns: [] },
    };
    expect(mapContradictionToCaseRisks([r])[0]!.kind).toBe("PRECEDENT_DIVERGENCE");
  });
  it("classifica versão histórica como HISTORIC_VERSION", () => {
    const r: ContradictionRisk = {
      id: "x", severity: "baixa", title: "Versão histórica", detail: "Versão anterior recuperada.", evidence: { chunkIds: [], normUrns: [] },
    };
    expect(mapContradictionToCaseRisks([r])[0]!.kind).toBe("HISTORIC_VERSION");
  });
  it("classifica lacuna como MISSING_GROUNDING", () => {
    const r: ContradictionRisk = {
      id: "x", severity: "media", title: "Sem fundamentação", detail: "Sem ancoragem normativa.", evidence: { chunkIds: [], normUrns: [] },
    };
    expect(mapContradictionToCaseRisks([r])[0]!.kind).toBe("MISSING_GROUNDING");
  });
  it("default OTHER", () => {
    const r: ContradictionRisk = {
      id: "x", severity: "baixa", title: "Algo", detail: "Genérico.", evidence: { chunkIds: [], normUrns: [] },
    };
    expect(mapContradictionToCaseRisks([r])[0]!.kind).toBe("OTHER");
  });
});
