import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefaultFundamentalIntakeForm,
  parseFundamentalIntakeForm,
} from "@/lib/cases/fundamental-intake/form-schema";
import { intakeFormContainsLegacyPlaceholders } from "@/lib/cases/fundamental-intake/intake-placeholder-guard";
import {
  nextSuggestedQuestion,
  sectionStatuses,
  topIntakeHighlightItems,
} from "@/components/cases/fundamental-intake-helpers";

const FORM_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/cases/fundamental-intake-form.tsx"),
  "utf-8",
);
const SIDEBAR_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/intake/intake-compact-sidebar.tsx"),
  "utf-8",
);
const HELPERS_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/cases/fundamental-intake-helpers.ts"),
  "utf-8",
);

describe("Fase 3.2 — sidebar compacta", () => {
  it("usa IntakeCompactSidebar com checklist colapsável", () => {
    expect(FORM_SRC).toMatch(/IntakeCompactSidebar/);
    expect(SIDEBAR_SRC).toMatch(/data-testid="intake-checklist-toggle"/);
    expect(SIDEBAR_SRC).toMatch(/Ver checklist completo/);
    expect(SIDEBAR_SRC).not.toMatch(/open=\{true\}/);
  });

  it("não usa sidebar fixed nem checklist aberto na coluna principal", () => {
    expect(FORM_SRC).not.toMatch(/IntakeSidebarPanel/);
    expect(FORM_SRC).not.toMatch(/md:fixed/);
    expect(FORM_SRC).not.toMatch(/IntakeComplementChecklistPanel items=\{complementChecklist\}/);
  });

  it("layout em grid sem padding compensando sidebar fixa", () => {
    expect(FORM_SRC).toMatch(/grid-cols-\[minmax\(0,1fr\)_260px\]/);
    expect(FORM_SRC).not.toMatch(/md:pr-\[calc\(var\(--intake-sidebar-w\)/);
  });

  it("topIntakeHighlightItems limita a 3 itens", () => {
    const form = createDefaultFundamentalIntakeForm();
    const many = topIntakeHighlightItems(form, 3);
    expect(many.length).toBeLessThanOrEqual(3);
    expect(SIDEBAR_SRC).toMatch(/highlightItems/);
  });

  it("expõe próxima pergunta sugerida", () => {
    const form = createDefaultFundamentalIntakeForm();
    expect(nextSuggestedQuestion(form)).toMatch(/Título|Continuar/);
    expect(FORM_SRC).toMatch(/nextSuggestedQuestion/);
  });
});

describe("Fase 3.2 — cards e progressive disclosure", () => {
  it("card 10 continua removido", () => {
    expect(FORM_SRC).not.toMatch(/step=\{10\}/);
    expect(FORM_SRC).not.toMatch(/Revisão antes de salvar/);
  });

  it("sem checkbox Dados revisados pelo advogado", () => {
    expect(FORM_SRC).not.toMatch(/Dados revisados pelo advogado/);
  });

  it("CNJ só com processo existente", () => {
    expect(FORM_SRC).toMatch(/preOrProcess === "existing_process"/);
  });

  it("detalhes administrativos em accordion", () => {
    expect(FORM_SRC).toMatch(/Detalhes administrativos/);
    expect(FORM_SRC).toMatch(/IntakeDisclosure/);
  });

  it("cliente com accordions detalhes e endereço", () => {
    expect(FORM_SRC).toMatch(/Detalhes pessoais/);
    expect(FORM_SRC).toMatch(/title="Endereço"/);
  });

  it("parte contrária desconhecida usa estado vazio", () => {
    expect(FORM_SRC).toMatch(/IntakeEmptyHint/);
    expect(FORM_SRC).toMatch(/opposing\.unknown/);
  });

  it("gestão do atendimento opcional e não bloqueia progresso", () => {
    expect(FORM_SRC).toMatch(/Gestão do atendimento/);
    expect(FORM_SRC).toMatch(/tone="optional"/);
    expect(HELPERS_SRC).toMatch(/communication: "complete"/);
  });

  it("LegalSectionCard suporta tone", () => {
    expect(FORM_SRC).toMatch(/tone="essential"/);
  });
});

describe("Fase 3.2 — placeholders e schema", () => {
  it("defaults sem placeholders legados", () => {
    const form = createDefaultFundamentalIntakeForm();
    expect(intakeFormContainsLegacyPlaceholders(form)).toBe(false);
    expect(form.attend.preOrProcess).toBe("pre_processual");
  });

  it("parse mantém normalização", () => {
    const draft = createDefaultFundamentalIntakeForm();
    draft.attend.suggestedTitle = "Novo caso";
    draft.clientPerson!.fullName = "Maria Silva";
    draft.narrative.whatHappened = "Relato válido com mais de dez caracteres.";
    const parsed = parseFundamentalIntakeForm(draft);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.attend.suggestedTitle).toBe("");
    }
  });

  it("communication sempre completa no status de seção", () => {
    const form = createDefaultFundamentalIntakeForm();
    expect(sectionStatuses(form).communication).toBe("complete");
  });
});
