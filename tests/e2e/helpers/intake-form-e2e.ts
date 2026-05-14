import { createDefaultFundamentalIntakeForm } from "../../../src/lib/cases/fundamental-intake/form-schema";
import type { FundamentalIntakeForm } from "../../../src/lib/cases/fundamental-intake/form-schema";

/**
 * Formulário fundamental válido para estruturação Lex AI (Vitest/Playwright).
 * Usa CPF de teste já aceito pela validação do projeto.
 */
export function buildE2eFundamentalIntakeForm(seed: string): FundamentalIntakeForm {
  const base = createDefaultFundamentalIntakeForm();
  return {
    ...base,
    attend: {
      ...base.attend,
      suggestedTitle: `E2E Case Flow ${seed}`,
      city: "São Paulo",
      uf: "SP",
      preOrProcess: "pre_processual",
    },
    clientPerson: {
      ...base.clientPerson,
      fullName: `Cliente E2E ${seed}`,
      cpf: "529.982.247-25",
    },
    opposing: {
      unknown: false,
      parties: [
        {
          name: `Réu E2E ${seed}`,
          document: "",
          address: "",
          city: "",
          uf: "",
          phone: "",
          email: "",
          relationToClient: "",
          participation: "",
        },
      ],
    },
    narrative: {
      ...base.narrative,
      whatHappened:
        "Relato E2E: contrato de prestação de serviços não cumprido, inadimplemento de parcelas e recusa em devolver documentação da autora.",
    },
    goals: {
      ...base.goals,
      clientWants: "Recebimento dos valores devidos e devolução de documentos.",
    },
    documents: {
      checklist: {
        ...base.documents.checklist,
        contract: true,
      },
      missingNotes: "",
      documentIds: [],
    },
  };
}
