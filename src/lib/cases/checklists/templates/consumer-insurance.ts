import type { ChecklistTemplate } from "../registry";

export const CONSUMER_INSURANCE_CHECKLIST: ChecklistTemplate = {
  id: "consumidor.plano_saude.cobertura",
  label: "Consumidor — plano de saúde (negativa de cobertura)",
  version: 1,
  area: ["Consumidor", "Saúde"],
  triggers: {
    keywords: ["plano de saúde", "negativa", "cobertura", "procedimento", "cirurgia", "ans", "carência"],
    brainHints: ["saúde", "consumidor"],
  },
  sections: [
    {
      id: "partes",
      title: "1. Partes e apólice",
      fields: [
        { id: "benef_name", label: "Nome do beneficiário", kind: "text", required: true, blocker: true },
        { id: "operator", label: "Operadora do plano", kind: "text", required: true, blocker: true },
        { id: "policy", label: "Número do contrato/cartão (se houver)", kind: "text", required: false },
      ],
    },
    {
      id: "negativa",
      title: "2. Negativa e urgência",
      fields: [
        { id: "procedure", label: "Qual procedimento/exame foi negado?", kind: "long_text", required: true, blocker: true },
        { id: "denial_reason", label: "Qual foi o motivo alegado?", kind: "long_text", required: false },
        { id: "medical_urgency", label: "Há urgência médica? (risco/agravamento)", kind: "long_text", required: false },
      ],
    },
    {
      id: "docs",
      title: "3. Documentos",
      fields: [
        { id: "prescription", label: "Pedido/laudo médico (tem?)", kind: "boolean", required: true, blocker: true },
        { id: "denial_doc", label: "Comprovante da negativa (e-mail/protocolo/ofício)", kind: "boolean", required: false },
      ],
    },
  ],
};

