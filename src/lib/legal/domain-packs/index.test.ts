import { describe, it, expect } from "vitest";
import {
  ALL_DOMAIN_PACKS,
  getDomainPack,
  getDomainPackByArea,
  listDomainPackIds,
} from "./index";

describe("domain packs", () => {
  it("inclui as 14 áreas prioritárias", () => {
    const ids = listDomainPackIds();
    expect(ids.length).toBeGreaterThanOrEqual(14);
    expect(ids).toContain("civil");
    expect(ids).toContain("contratos");
    expect(ids).toContain("contencioso");
    expect(ids).toContain("familia");
    expect(ids).toContain("previdenciario");
    expect(ids).toContain("trabalho");
    expect(ids).toContain("crianca-adolescente");
    expect(ids).toContain("idoso");
    expect(ids).toContain("maria-da-penha");
    expect(ids).toContain("defesa-homem-maria-da-penha");
    expect(ids).toContain("representacao-mulher");
    expect(ids).toContain("advocacia-etica-prerrogativas");
    expect(ids).toContain("constitucional");
  });

  it("cada pack tem campos obrigatórios populados", () => {
    for (const pack of ALL_DOMAIN_PACKS) {
      expect(pack.label.length).toBeGreaterThan(0);
      expect(pack.area.length).toBeGreaterThan(0);
      expect(pack.description.length).toBeGreaterThan(0);
      expect(pack.seedQueries.length).toBeGreaterThan(0);
      expect(pack.requiredNorms.length).toBeGreaterThan(0);
      expect(pack.preferredTribunals.length).toBeGreaterThan(0);
      expect(pack.prioritySources.length).toBeGreaterThan(0);
    }
  });

  it("getDomainPack/getDomainPackByArea são consistentes", () => {
    const civil = getDomainPack("civil");
    expect(civil).not.toBeNull();
    expect(getDomainPackByArea("civil")?.id).toBe("civil");
  });

  it("retorna null para id inexistente", () => {
    expect(getDomainPack("inexistente" as never)).toBeNull();
    expect(getDomainPackByArea("inexistente")).toBeNull();
  });

  it("packs constitucional/maria-da-penha priorizam STF", () => {
    expect(getDomainPack("constitucional")?.preferredTribunals).toContain("STF");
    expect(getDomainPack("maria-da-penha")?.preferredTribunals).toContain("STF");
  });

  it("pack previdenciário inclui TRFs", () => {
    const prev = getDomainPack("previdenciario");
    const tribunals = prev?.preferredTribunals ?? [];
    expect(tribunals.some((t) => t.startsWith("TRF"))).toBe(true);
  });
});
