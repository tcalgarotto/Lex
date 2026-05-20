import { describe, expect, it } from "vitest";
import {
  cnjVisualError,
  isReadyForLexStructure,
  lexStructureBlockedReason,
} from "@/components/cases/fundamental-intake-helpers";
import { isValidCpf, isValidCnpj, onlyDigits } from "@/lib/cases/fundamental-intake/br-validators";
import { parseFundamentalIntakeForm, createDefaultFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { mergeStructureWithForm } from "@/lib/cases/fundamental-intake/fundamental-intake-service";
import { deepseekStructureResponseSchema } from "@/lib/cases/fundamental-intake/structured-output-schema";

describe("fundamental intake validators", () => {
  it("valida CPF conhecido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("valida CNPJ conhecido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("onlyDigits remove máscara", () => {
    expect(onlyDigits("12.345.678/0001-99")).toBe("12345678000199");
  });
});

describe("fundamental intake form schema", () => {
  it("cria default parseável", () => {
    const f = createDefaultFundamentalIntakeForm();
    const again = parseFundamentalIntakeForm(f);
    expect(again.success).toBe(true);
  });

  it("data de atendimento default é hoje (ISO)", () => {
    const today = new Date().toISOString().slice(0, 10);
    const f = createDefaultFundamentalIntakeForm();
    expect(f.attend.intakeDate).toBe(today);
  });

  it("pessoa jurídica exige razão social", () => {
    const r = parseFundamentalIntakeForm({
      attend: {
        suggestedTitle: "X",
        city: "São Paulo",
        uf: "SP",
        preOrProcess: "pre_processual",
      },
      clientKind: "COMPANY",
      clientCompany: { legalName: "" },
      narrative: { whatHappened: "12345678901" },
    });
    expect(r.success).toBe(false);
  });

  it("parte contrária desconhecida não exige nome", () => {
    const r = parseFundamentalIntakeForm({
      attend: { suggestedTitle: "Caso teste", city: "SP Capital", uf: "SP", preOrProcess: "pre_processual" },
      clientKind: "PERSON",
      clientPerson: { fullName: "Maria Teste", phone: "", email: "" },
      opposing: { unknown: true, parties: [] },
      narrative: { whatHappened: "Relato mínimo com mais de dez caracteres aqui." },
    });
    expect(r.success).toBe(true);
  });
});

describe("cnjVisualError", () => {
  it("retorna null quando vazio", () => {
    expect(cnjVisualError("")).toBeNull();
    expect(cnjVisualError("   ")).toBeNull();
  });

  it("rejeita CNJ com menos de 20 dígitos", () => {
    expect(cnjVisualError("1234567-89.0123.4.56.789")).toContain("CNJ");
  });
});

describe("isReadyForLexStructure (campos com * na UI)", () => {
  it("formulário vazio não libera Lex até preencher obrigatórios", () => {
    const f = createDefaultFundamentalIntakeForm();
    expect(isReadyForLexStructure(f)).toBe(false);
    expect(lexStructureBlockedReason(f)).toMatch(/obrigatório/i);
  });

  it("não libera Lex sem UF (obrigatório *)", () => {
    const f = createDefaultFundamentalIntakeForm();
    f.attend.uf = "";
    expect(isReadyForLexStructure(f)).toBe(false);
    expect(lexStructureBlockedReason(f)).toMatch(/UF/);
  });

  it("modo só relato livre exige texto livre mínimo", () => {
    const f = createDefaultFundamentalIntakeForm();
    f.freeNarrativeOnly = true;
    f.narrative.freeText = "";
    expect(isReadyForLexStructure(f)).toBe(false);
    expect(lexStructureBlockedReason(f)).toMatch(/Relato livre/);
  });

  it("permite Lex com payload mínimo válido e asteriscos ok", () => {
    const r = parseFundamentalIntakeForm({
      attend: { suggestedTitle: "Caso X", city: "São Paulo", uf: "SP", preOrProcess: "pre_processual" },
      clientKind: "PERSON",
      clientPerson: { fullName: "Maria Silva", cpf: "" },
      opposing: { unknown: true, parties: [] },
      narrative: { whatHappened: "12345678901 relato com mais de dez caracteres." },
      documents: { checklist: {} },
      goals: { clientWants: "" },
      timeline: [],
    });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error("expected parse success");
    expect(isReadyForLexStructure(r.data)).toBe(true);
    expect(lexStructureBlockedReason(r.data)).toBeNull();
  });
});

describe("mergeStructureWithForm", () => {
  it("mantém autor do formulário e adiciona lacuna quando réu desconhecido", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson = { ...form.clientPerson!, fullName: "Autora Fixa", cpf: "" };
    form.opposing = { unknown: true, parties: [] };
    const ai = deepseekStructureResponseSchema.parse({
      parties: [
        { role: "AUTHOR", kind: "PERSON", name: "Nome Errado IA", document: null, confidence: 0.5 },
        { role: "DEFENDANT", kind: "COMPANY", name: "Ré IA", document: null, confidence: 0.4 },
      ],
      facts: [{ text: "Fato da IA", confidence: 0.5 }],
      risks: [],
    });
    const merged = mergeStructureWithForm(form, ai);
    expect(merged.parties[0]!.name).toBe("Autora Fixa");
    expect(merged.risks.some((r) => /não identificada/i.test(r.title))).toBe(true);
  });
});

describe("POST /api/cases/fundamental-intake (contrato)", () => {
  it("exporta rota POST", async () => {
    const mod = await import("@/app/api/cases/fundamental-intake/route");
    expect(typeof mod.POST).toBe("function");
  });
});
