import { describe, expect, it } from "vitest";
import { buildCourtPublicQueryUrl, buildDataJudOfficialLink } from ".";

describe("court public links", () => {
  it("builds official tribunal links with encoded CNJ", () => {
    const link = buildCourtPublicQueryUrl({
      cnj: "5000200-09.2016.8.21.0160",
      tribunalAcronym: "TJRS",
    });
    expect(link.url).toContain("tjrs.jus.br");
    expect(link.url).toContain(encodeURIComponent("5000200-09.2016.8.21.0160"));
    expect(link.instruction).toContain("oficial");
  });

  it("falls back to instructions when there is no stable official URL", () => {
    const link = buildCourtPublicQueryUrl({ cnj: "123", tribunalAcronym: "TJXX" });
    expect(link.url).toBeNull();
    expect(link.instruction).toContain("Não há link público estável");
  });

  it("points DataJud to official public documentation", () => {
    const link = buildDataJudOfficialLink();
    expect(link.url).toContain("cnj.jus.br");
    expect(link.instruction).toContain("metadados");
  });
});
