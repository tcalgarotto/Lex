import type { ChecklistTemplate } from "../registry";

export const CIVIL_MEDICAL_MALPRACTICE_CHECKLIST: ChecklistTemplate = {
  id: "civil.responsabilidade.erro_medico",
  label: "Cível — responsabilidade civil (erro médico)",
  version: 1,
  area: ["Cível", "Saúde"],
  triggers: {
    keywords: ["erro médico", "hospital", "cirurgia", "laudo", "prontuário", "indenização", "médico"],
    brainHints: ["saúde", "cível"],
  },
  sections: [
    {
      id: "evento",
      title: "1. Evento e danos",
      fields: [
        { id: "patient", label: "Paciente (nome)", kind: "text", required: true, blocker: true },
        { id: "provider", label: "Hospital/clínica/médico (se souber)", kind: "text", required: false },
        { id: "what", label: "O que ocorreu? (descrição)", kind: "long_text", required: true, blocker: true },
      ],
    },
    {
      id: "docs",
      title: "2. Documentos",
      fields: [
        { id: "records", label: "Prontuário/relatórios (tem?)", kind: "boolean", required: false },
        { id: "exams", label: "Exames/laudos (tem?)", kind: "boolean", required: false },
      ],
    },
  ],
};

