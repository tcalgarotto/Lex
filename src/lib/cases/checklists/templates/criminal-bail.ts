import type { ChecklistTemplate } from "../registry";

export const CRIMINAL_BAIL_CHECKLIST: ChecklistTemplate = {
  id: "criminal.audiencia.custodia",
  label: "Criminal — audiência de custódia/liberdade",
  version: 1,
  area: ["Criminal"],
  triggers: {
    keywords: ["prisão", "flagrante", "custódia", "audiência", "liberdade", "fiança", "habeas corpus"],
    brainHints: ["criminal"],
  },
  sections: [
    {
      id: "pessoa",
      title: "1. Pessoa presa e contexto",
      fields: [
        { id: "name", label: "Nome do preso", kind: "text", required: true, blocker: true },
        { id: "where", label: "Onde está custodiado (unidade/cidade)", kind: "text", required: false },
        { id: "when", label: "Data/hora aproximada da prisão", kind: "text", required: false },
      ],
    },
    {
      id: "fatos",
      title: "2. Fatos e documentos",
      fields: [
        { id: "facts", label: "Descrição dos fatos (o que alegam)", kind: "long_text", required: true, blocker: true },
        { id: "papers", label: "Auto de prisão/BO/decisão (se houver)", kind: "long_text", required: false },
      ],
    },
  ],
};

