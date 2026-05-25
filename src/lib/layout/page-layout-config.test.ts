import { describe, expect, it } from "vitest";
import { getPageLayoutConfig, matchRouteLayout } from "./page-layout-config";

describe("getPageLayoutConfig", () => {
  it("agenda e sub-rotas usam bleed", () => {
    expect(getPageLayoutConfig("/agenda")).toEqual({ bleed: true, contentMode: "bleed" });
    expect(getPageLayoutConfig("/agenda/")).toEqual({ bleed: true, contentMode: "bleed" });
    expect(getPageLayoutConfig("/agenda?view=week")).toEqual({ bleed: true, contentMode: "bleed" });
  });

  it("demais rotas mantêm standard", () => {
    expect(getPageLayoutConfig("/dashboard")).toEqual({ bleed: false, contentMode: "standard" });
    expect(getPageLayoutConfig("/cases/abc")).toEqual({ bleed: false, contentMode: "standard" });
  });
});

describe("matchRouteLayout", () => {
  it("classifica agenda (three-well, bleed)", () => {
    const s = matchRouteLayout("/agenda");
    expect(s.bleed).toBe(true);
    expect(s.frame).toBe("three-well");
    expect(s.centerWidth).toBe("wide");
    expect(s.rightRail).toBe("required");
  });

  it("classifica dashboard (cockpit full-width)", () => {
    const s = matchRouteLayout("/dashboard");
    expect(s.usesLexCenterGrid).toBe(false);
    expect(s.centerWidth).toBe("full");
    expect(s.bleed).toBe(false);
  });

  it("classifica detalhe do caso (right-rail)", () => {
    expect(matchRouteLayout("/cases/uuid-1").frame).toBe("right-rail");
    expect(matchRouteLayout("/cases/uuid-1/documentos").rightRail).toBe("required");
  });

  it("classifica lista de casos e /cases/new", () => {
    expect(matchRouteLayout("/cases").frame).toBe("standard");
    expect(matchRouteLayout("/cases/new").centerWidth).toBe("wide");
  });

  it("classifica processos lista vs detalhe vs analytics", () => {
    expect(matchRouteLayout("/processos").bleed).toBe(false);
    expect(matchRouteLayout("/processos/analytics").frame).toBe("standard");
    expect(matchRouteLayout("/processos/abc123").rightRail).toBe("optional");
  });

  it("classifica settings e documentos", () => {
    expect(matchRouteLayout("/settings/integracoes").centerWidth).toBe("default");
    expect(matchRouteLayout("/documentos").centerWidth).toBe("wide");
  });
});
