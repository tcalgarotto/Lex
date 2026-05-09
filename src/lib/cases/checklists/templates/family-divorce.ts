import type { ChecklistTemplate } from "../registry";

export const FAMILY_DIVORCE_CHECKLIST: ChecklistTemplate = {
  id: "familia.divorcio.partilha",
  label: "Família — divórcio e partilha",
  version: 1,
  area: ["Família"],
  triggers: {
    keywords: ["divórcio", "separação", "partilha", "regime de bens", "união estável", "guarda"],
    brainHints: ["família"],
  },
  sections: [
    {
      id: "casamento",
      title: "1. Relação e regime",
      fields: [
        { id: "spouses", label: "Nomes das partes", kind: "long_text", required: true, blocker: true },
        { id: "regime", label: "Regime de bens (se souber)", kind: "text", required: false },
        { id: "children", label: "Há filhos menores? (nomes/idades)", kind: "long_text", required: false },
      ],
    },
    {
      id: "bens",
      title: "2. Bens e dívidas",
      fields: [
        { id: "assets", label: "Bens a partilhar (imóveis, veículos, etc.)", kind: "long_text", required: false },
        { id: "debts", label: "Dívidas relevantes", kind: "long_text", required: false },
      ],
    },
  ],
};

