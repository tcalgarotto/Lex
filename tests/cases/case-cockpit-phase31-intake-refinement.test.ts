import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultFundamentalIntakeForm,
  parseFundamentalIntakeForm,
} from "@/lib/cases/fundamental-intake/form-schema";
import {
  normalizeIntakeFormPlaceholders,
  intakeFormContainsLegacyPlaceholders,
} from "@/lib/cases/fundamental-intake/intake-placeholder-guard";
import { validateBrDateString } from "@/lib/forms/br-date-validation";
import { isValidBrUf, BR_UF_ENTRIES } from "@/lib/forms/br-uf";
import { isValidMaritalStatus, maritalStatusLabel } from "@/lib/forms/marital-status";
import { mergeStructureWithForm } from "@/lib/cases/fundamental-intake/fundamental-intake-service";
import { lookupAddressByCep } from "@/lib/address/address-lookup";
import { INTAKE_GUIDED_STEPS } from "@/lib/cases/fundamental-intake/intake-guided-flow";

const FORM_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/cases/fundamental-intake-form.tsx"),
  "utf-8",
);

describe("Fase 3.1 — placeholders", () => {
  it("defaults não contêm textos de placeholder legados", () => {
    const form = createDefaultFundamentalIntakeForm();
    expect(form.attend.suggestedTitle).toBe("");
    expect(form.attend.city).toBe("");
    expect(form.clientPerson?.fullName).toBe("");
    expect(form.narrative.whatHappened).toBe("");
    expect(intakeFormContainsLegacyPlaceholders(form)).toBe(false);
  });

  it("normaliza placeholders legados antes de persistir", () => {
    const raw = createDefaultFundamentalIntakeForm();
    raw.attend.suggestedTitle = "Novo caso";
    raw.attend.city = "Cidade do caso";
    const normalized = normalizeIntakeFormPlaceholders(raw);
    expect(normalized.attend.suggestedTitle).toBe("");
    expect(normalized.attend.city).toBe("");
  });

  it("parseFundamentalIntakeForm aplica normalização ao persistir", () => {
    const draft = createDefaultFundamentalIntakeForm();
    draft.attend.suggestedTitle = "Novo caso";
    draft.attend.city = "Cidade do caso";
    draft.clientPerson!.fullName = "Maria Silva";
    draft.narrative.whatHappened = "Relato válido com mais de dez caracteres.";
    const parsed = parseFundamentalIntakeForm(draft);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.attend.suggestedTitle).toBe("");
      expect(parsed.data.attend.city).toBe("");
    }
  });
});

describe("Fase 3.1 — UI estrutural", () => {
  it("não exibe card 10 Revisão antes de salvar", () => {
    expect(FORM_SRC).not.toMatch(/step=\{10\}/);
    expect(FORM_SRC).not.toMatch(/Revisão antes de salvar/);
    expect(FORM_SRC).not.toMatch(/INTAKE_REVIEW_ANCHOR/);
  });

  it("não exibe checkbox Dados revisados pelo advogado", () => {
    expect(FORM_SRC).not.toMatch(/Dados revisados pelo advogado/);
    expect(FORM_SRC).not.toMatch(/sectionReviewFooter/);
  });

  it("checklist complementar na sidebar compacta (colapsável)", () => {
    expect(FORM_SRC).toMatch(/IntakeCompactSidebar/);
    expect(FORM_SRC).toMatch(/checklistItems=\{complementChecklist\}/);
  });

  it("CNJ só com processo existente", () => {
    expect(FORM_SRC).toMatch(/preOrProcess === "existing_process"/);
  });

  it("default pré-processual no schema", () => {
    expect(createDefaultFundamentalIntakeForm().attend.preOrProcess).toBe("pre_processual");
  });
});

describe("Fase 3.1 — datas", () => {
  it("rejeita 55/55/5555", () => {
    expect(validateBrDateString("55/55/5555").ok).toBe(false);
  });

  it("rejeita 31/02/2026", () => {
    expect(validateBrDateString("31/02/2026").ok).toBe(false);
  });

  it("aceita 29/02/2024", () => {
    const r = validateBrDateString("29/02/2024");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe("2024-02-29");
  });

  it("rejeita nascimento futuro", () => {
    expect(validateBrDateString("01/01/2099", "birth").ok).toBe(false);
  });
});

describe("Fase 3.1 — UF e estado civil", () => {
  it("UF: ordem alfabética por nome e rejeita XX", () => {
    const names = BR_UF_ENTRIES.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
    expect(isValidBrUf("XX")).toBe(false);
    expect(isValidBrUf("SP")).toBe(true);
  });

  it("estado civil canônico", () => {
    expect(isValidMaritalStatus("casado")).toBe(true);
    expect(isValidMaritalStatus("inventado")).toBe(false);
    expect(maritalStatusLabel("uniao_estavel")).toBe("União estável");
  });
});

describe("Fase 3.1 — IA não sobrescreve relato manual", () => {
  it("mergeStructureWithForm mantém narrativa do formulário intacta", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "João";
    form.narrative.whatHappened = "Relato manual preservado pelo advogado na entrevista.";
    const before = form.narrative.whatHappened;
    mergeStructureWithForm(form, {
      parties: [],
      facts: [{ text: "Fato gerado pela IA.", confidence: 0.5 }],
      requests: [],
      risks: [],
      timeline: [],
      missing_documents: [],
      missing_questions: [],
      information_gaps: [],
      next_steps: [],
      case_summary: "Resumo IA",
      party_relations: [],
      evidence_mentioned: [],
      needs_confirmation: [],
    });
    expect(form.narrative.whatHappened).toBe(before);
  });
});

describe("Fase 3.1 — endereço (CEP)", () => {
  it("CEP válido preenche via ViaCEP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          logradouro: "Rua Teste",
          bairro: "Centro",
          localidade: "Porto Alegre",
          uf: "RS",
        }),
      }),
    );
    const r = await lookupAddressByCep("90010000");
    expect("cep" in (r as { cep: string })).toBe(true);
    if ("street" in r) {
      expect(r.city).toBe("Porto Alegre");
      expect(r.uf).toBe("RS");
    }
    vi.unstubAllGlobals();
  });

  it("CEP inválido retorna erro", async () => {
    const r = await lookupAddressByCep("123");
    expect(r).toMatchObject({ code: "INVALID_CEP" });
  });
});

describe("Fase 3.1 — stepper guiado", () => {
  it("tem 8 etapas sem revisão", () => {
    expect(INTAKE_GUIDED_STEPS).toHaveLength(8);
    expect(INTAKE_GUIDED_STEPS.map((s) => s.id)).not.toContain("review");
  });
});

describe("Fase 3.1 — chave Google não no client", () => {
  it("lookup de endereço só no servidor", () => {
    const route = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/api/address/lookup/route.ts"),
      "utf-8",
    );
    expect(route).toMatch(/lookupAddressByCep/);
    expect(
      fs.readFileSync(
        path.resolve(__dirname, "../../src/components/intake/client-address-fields.tsx"),
        "utf-8",
      ),
    ).toMatch(/\/api\/address\/lookup/);
    expect(FORM_SRC).not.toMatch(/GOOGLE_MAPS_API_KEY/);
  });
});
