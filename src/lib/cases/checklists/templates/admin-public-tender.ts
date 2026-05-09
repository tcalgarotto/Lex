import type { ChecklistTemplate } from "../registry";

export const ADMIN_PUBLIC_TENDER_CHECKLIST: ChecklistTemplate = {
  id: "administrativo.concurso.publico",
  label: "Administrativo — concurso público (nomeação/posse)",
  version: 1,
  area: ["Administrativo"],
  triggers: {
    keywords: ["concurso", "nomeação", "posse", "edital", "cadastro reserva", "classificação", "convocação"],
    brainHints: ["administrativo"],
  },
  sections: [
    {
      id: "edital",
      title: "1. Edital e classificação",
      fields: [
        { id: "candidate", label: "Nome do candidato", kind: "text", required: true, blocker: true },
        { id: "organ", label: "Órgão/entidade do concurso", kind: "text", required: true, blocker: true },
        { id: "position", label: "Cargo", kind: "text", required: false },
        { id: "rank", label: "Classificação/posição (se souber)", kind: "text", required: false },
      ],
    },
    {
      id: "ato",
      title: "2. Ato impugnado",
      fields: [
        { id: "what", label: "Qual é o problema? (não nomeação, preterição, atraso)", kind: "long_text", required: true, blocker: true },
        { id: "docs", label: "Documentos (edital, classificação, convocações)", kind: "long_text", required: false },
      ],
    },
  ],
};

