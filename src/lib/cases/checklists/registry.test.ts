import { describe, expect, it } from "vitest";
import {
  computeMissingFields,
  getChecklistTemplate,
  isFieldAnswered,
  listChecklistTemplates,
  suggestChecklistTemplate,
} from "./registry";

describe("checklist registry", () => {
  it("lista pelo menos o template de creche", () => {
    const all = listChecklistTemplates();
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((t) => t.id === "constitucional.educacao.creche")).toBe(true);
  });

  it("recupera template por id", () => {
    const t = getChecklistTemplate("constitucional.educacao.creche");
    expect(t).not.toBeNull();
    expect(t?.label).toMatch(/creche/i);
  });

  it("retorna null para id inexistente", () => {
    expect(getChecklistTemplate("nao-existe")).toBeNull();
  });

  it("sugere template por keyword na rawText", () => {
    const t = suggestChecklistTemplate({ rawText: "Cliente quer vaga em creche para o filho" });
    expect(t?.id).toBe("constitucional.educacao.creche");
  });

  it("sugere template por brainAreas", () => {
    const t = suggestChecklistTemplate({ brainAreas: ["educação", "constitucional"] });
    expect(t?.id).toBe("constitucional.educacao.creche");
  });

  it("retorna null quando rawText/areas não casam com nenhum template", () => {
    const t = suggestChecklistTemplate({ rawText: "litígio empresarial complexo de M&A" });
    expect(t).toBeNull();
  });

  it("computeMissingFields lista apenas obrigatórios não respondidos", () => {
    const t = getChecklistTemplate("constitucional.educacao.creche")!;
    const missing = computeMissingFields(t, {});
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((f) => f.required)).toBe(true);
  });

  it("isFieldAnswered diferencia tipos", () => {
    expect(isFieldAnswered({ id: "x", label: "x", kind: "text", required: true }, "")).toBe(
      false,
    );
    expect(
      isFieldAnswered({ id: "x", label: "x", kind: "text", required: true }, "valor"),
    ).toBe(true);
    expect(
      isFieldAnswered({ id: "x", label: "x", kind: "boolean", required: true }, false),
    ).toBe(true);
    expect(
      isFieldAnswered(
        { id: "x", label: "x", kind: "multi_choice", required: true, options: [] },
        [],
      ),
    ).toBe(false);
    expect(
      isFieldAnswered(
        { id: "x", label: "x", kind: "multi_choice", required: true, options: [] },
        ["a"],
      ),
    ).toBe(true);
  });
});
