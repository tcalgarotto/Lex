import type { ChecklistTemplate } from "../registry";

export const FAMILY_CHILD_SUPPORT_CHECKLIST: ChecklistTemplate = {
  id: "familia.alimentos.filhos",
  label: "Família — alimentos (filhos)",
  version: 1,
  area: ["Família"],
  triggers: {
    keywords: ["alimentos", "pensão", "guarda", "visita", "filho", "criança", "genitor"],
    brainHints: ["família", "criança"],
  },
  sections: [
    {
      id: "partes",
      title: "1. Partes e filhos",
      fields: [
        { id: "guardian", label: "Responsável que procura o escritório", kind: "text", required: true, blocker: true },
        { id: "other_parent", label: "Outro genitor (nome)", kind: "text", required: true, blocker: true },
        { id: "children", label: "Filhos (nomes e idades)", kind: "long_text", required: true, blocker: true },
      ],
    },
    {
      id: "necessidades",
      title: "2. Necessidades e capacidade",
      fields: [
        { id: "expenses", label: "Despesas mensais principais (escola, saúde, alimentação)", kind: "long_text", required: false },
        { id: "income_other", label: "Renda/ocupação do outro genitor (se souber)", kind: "text", required: false },
      ],
    },
  ],
};

