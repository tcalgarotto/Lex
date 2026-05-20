import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultFundamentalIntakeForm, parseFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { mergeStructureWithForm } from "@/lib/cases/fundamental-intake/fundamental-intake-service";
import { deepseekStructureResponseSchema } from "@/lib/cases/fundamental-intake/structured-output-schema";
import { sanitizeStructuredSummary } from "@/lib/cases/fundamental-intake/structure-quality";
import { buildCaseDisplaySnapshot } from "@/lib/cases/intake/case-intake-context";
import { INTAKE_GUIDED_STEPS } from "@/lib/cases/fundamental-intake/intake-guided-flow";
import { buildIntakeComplementChecklist } from "@/lib/cases/fundamental-intake/intake-complement-checklist";

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, "../../src/app/api/cases/fundamental-intake/route.ts"),
  "utf-8",
);

const FORM_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/cases/fundamental-intake-form.tsx"),
  "utf-8",
);

describe("Fase 3 — entrevista guiada", () => {
  it("define 8 etapas guiadas (sem card de revisão)", () => {
    expect(INTAKE_GUIDED_STEPS).toHaveLength(8);
    expect(INTAKE_GUIDED_STEPS.map((s) => s.label)).toEqual([
      "Relato inicial",
      "Partes envolvidas",
      "Datas e cronologia",
      "Documentos e provas",
      "Comunicações",
      "Urgência",
      "Objetivo do cliente",
      "Processo judicial?",
    ]);
  });

  it("UI: CNJ condicional quando existe processo", () => {
    expect(FORM_SRC).toMatch(/preOrProcess === "existing_process"/);
    expect(FORM_SRC).toMatch(/value: "pre_processual"/);
  });

  it("checklist complementar cobre perguntas MVP", () => {
    const items = buildIntakeComplementChecklist(createDefaultFundamentalIntakeForm());
    const questions = items.map((i) => i.question);
    expect(questions.some((q) => q.includes("cliente"))).toBe(true);
    expect(questions.some((q) => q.includes("processo judicial"))).toBe(true);
    expect(questions.some((q) => q.includes("urgência"))).toBe(true);
  });
});

describe("Fase 3 — caso pré-processual sem CNJ", () => {
  it("aceita formulário pré-processual sem CNJ", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.attend.preOrProcess = "pre_processual";
    form.attend.cnj = "";
    form.clientPerson!.fullName = "Maria Silva";
    form.narrative.whatHappened = "Relato com mais de dez caracteres para validação.";
    const parsed = parseFundamentalIntakeForm(form);
    expect(parsed.success).toBe(true);
  });

  it("checklist marca processo como ok em pré-processual sem CNJ", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.attend.preOrProcess = "pre_processual";
    const processItem = buildIntakeComplementChecklist(form).find((i) => i.id === "process");
    expect(processItem?.status).toBe("answered");
    expect(processItem?.hint).toMatch(/pré-processual/i);
  });
});

describe("Fase 3 — estruturação IA", () => {
  it("schema exige campos estruturados enriquecidos", () => {
    const sample = deepseekStructureResponseSchema.parse({
      parties: [{ role: "AUTHOR", name: "A", confidence: 0.9 }],
      facts: [{ text: "Fato em 2024.", dates: ["2024"], confidence: 0.7 }],
      requests: [{ text: "Indenização", kind: "MAIN" }],
      risks: [{ title: "Lacuna", detail: "Falta prova", severity: "MEDIUM" }],
      timeline: [],
      missing_documents: [],
      missing_questions: ["Qual a data exata?"],
      information_gaps: ["Contrato não juntado"],
      next_steps: ["Solicitar contrato"],
      case_summary: "Resumo sintético do caso.",
      party_relations: [{ from: "A", to: "B", relation: "locador/locatário" }],
      evidence_mentioned: ["Print WhatsApp"],
      needs_confirmation: ["Confirmar valor do aluguel"],
    });
    expect(sample.missing_questions.length).toBeGreaterThan(0);
    expect(sample.information_gaps.length).toBeGreaterThan(0);
  });

  it("sanitiza resumo que copia o relato bruto", () => {
    const narrative = "O cliente relatou que o vizinho invadiu o imóvel e causou danos repetidos no muro e na calçada conforme descrito em detalhes longos no atendimento presencial.";
    const copy = narrative;
    const out = sanitizeStructuredSummary(copy, narrative, "Resumo estruturado.");
    expect(out).toBe("Resumo estruturado.");
  });

  it("mergeStructureWithForm produz fatos e perguntas", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "João";
    form.narrative.whatHappened = "Inadimplemento contratual em março de 2024.";
    const merged = mergeStructureWithForm(form, {
      parties: [],
      facts: [{ text: "Contrato firmado em janeiro.", confidence: 0.8 }],
      requests: [{ text: "Rescisão e perdas", kind: "MAIN" }],
      risks: [],
      timeline: [],
      missing_documents: [],
      missing_questions: ["Há notificação extrajudicial?"],
      information_gaps: ["Comprovante de pagamento"],
      next_steps: ["Juntar contrato"],
      case_summary: "Caso de inadimplemento locatício.",
      party_relations: [],
      evidence_mentioned: [],
      needs_confirmation: [],
    });
    expect(merged.parties.some((p) => p.role === "AUTHOR")).toBe(true);
    expect(merged.facts.length).toBeGreaterThan(0);
    expect(merged.missing_questions.length).toBeGreaterThan(0);
  });
});

describe("Fase 3 — Fatos e partes (display)", () => {
  it("não concatena relato inteiro em um único fato", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "Maria Silva";
    form.narrative.whatHappened = "Primeiro parágrafo do relato.";
    form.narrative.whenHappened = "Em março de 2024";
    form.narrative.whereHappened = "São Paulo";
    const parsed = parseFundamentalIntakeForm(form);
    expect(parsed.success).toBe(true);
    const display = buildCaseDisplaySnapshot({
      metadataJson: { intakeForm: parsed.success ? parsed.data : form, intakeFormSource: "intake_form" },
    });
    expect(display?.facts.length).toBeGreaterThanOrEqual(3);
    expect(display!.facts.some((f) => f.category === "relato" && f.text === "Primeiro parágrafo do relato.")).toBe(
      true,
    );
    expect(display!.facts.some((f) => f.category === "data")).toBe(true);
    expect(display!.facts.some((f) => f.category === "local")).toBe(true);
    expect(display!.facts.filter((f) => f.category === "relato").length).toBe(1);
  });

  it("usa intakeFundamental para perguntas e lacunas", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "Ana";
    form.narrative.whatHappened = "Relato mínimo com dez caracteres.";
    const display = buildCaseDisplaySnapshot({
      metadataJson: {
        intakeForm: form,
        intakeStructuredAt: new Date().toISOString(),
        intakeFundamental: {
          missingQuestions: ["Qual o valor da causa?"],
          informationGaps: ["Falta BO"],
          nextSteps: ["Colher provas"],
        },
      },
    });
    expect(display?.pendingQuestions).toContain("Qual o valor da causa?");
    expect(display?.gaps.some((g) => g.includes("Falta BO"))).toBe(true);
  });
});

describe("Fase 3 — API intake (compat)", () => {
  it("salvar não chama runDeepseekFundamentalStructure", () => {
    const saveStart = ROUTE.indexOf("if (isSaveAction(body.action))");
    const saveEnd = ROUTE.indexOf("let caseId = body.caseId", saveStart);
    const saveBlock = ROUTE.slice(saveStart, saveEnd);
    expect(saveBlock.indexOf("runDeepseekFundamentalStructure")).toBe(-1);
    expect(saveBlock).toMatch(/persistFundamentalDraft/);
  });

  it("reorganizar exige flag quando já organizado", () => {
    expect(ROUTE).toMatch(/REORGANIZE_REQUIRED/);
    expect(ROUTE).toMatch(/wantsReorganize/);
  });

  it("reorganizar na UI exige confirmação e envia flag", () => {
    expect(FORM_SRC).toMatch(/reorganizeDialogOpen/);
    expect(FORM_SRC).toMatch(/submit\("structure", \{ reorganize: true \}\)/);
  });
});

describe("Fase 3 — Fatos e partes (UI)", () => {
  it("renderiza seções derivadas do intake, não apenas rawInput", () => {
    const tab = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/cases/case-facts-parties-tab.tsx"),
      "utf-8",
    );
    expect(tab).toMatch(/CaseIntakeDerivedSections/);
    expect(tab).not.toMatch(/rawInput/);
  });
});

describe("Fase 3 — checklist legado", () => {
  it("entrevista mantém checklist legado para casos sem intake fundamental", () => {
    const p = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/(app)/cases/[id]/entrevista/page.tsx"),
      "utf-8",
    );
    expect(p).toMatch(/CaseChecklistTab/);
    expect(p).toMatch(/usesFundamentalIntakeFlow/);
  });
});
