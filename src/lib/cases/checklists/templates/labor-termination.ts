import type { ChecklistTemplate } from "../registry";

export const LABOR_TERMINATION_CHECKLIST: ChecklistTemplate = {
  id: "trabalho.rescisao.verbas",
  label: "Trabalhista — rescisão e verbas (CLT)",
  version: 1,
  area: ["Trabalhista"],
  triggers: {
    keywords: ["rescisão", "demissão", "justa causa", "verbas rescisórias", "fgts", "multa 40", "aviso prévio"],
    brainHints: ["trabalhista"],
  },
  sections: [
    {
      id: "vinculo",
      title: "1. Vínculo de trabalho",
      fields: [
        { id: "employee", label: "Nome do trabalhador", kind: "text", required: true, blocker: true },
        { id: "employer", label: "Empresa/empregador", kind: "text", required: true, blocker: true },
        { id: "start", label: "Data de admissão (aprox.)", kind: "text", required: false },
        { id: "end", label: "Data de desligamento (aprox.)", kind: "text", required: false },
      ],
    },
    {
      id: "rescisao",
      title: "2. Modalidade e pendências",
      fields: [
        { id: "type", label: "Como foi o desligamento?", kind: "long_text", required: true, blocker: true },
        { id: "owed", label: "O que está pendente (salário, férias, 13º, FGTS)?", kind: "long_text", required: false },
      ],
    },
  ],
};

