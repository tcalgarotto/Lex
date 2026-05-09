import type { ChecklistTemplate } from "../registry";

export const REAL_ESTATE_RENT_CHECKLIST: ChecklistTemplate = {
  id: "imobiliario.locacao.despejo",
  label: "Imobiliário — locação (inadimplência/despejo)",
  version: 1,
  area: ["Imobiliário"],
  triggers: {
    keywords: ["aluguel", "locação", "despejo", "inadimplência", "fiador", "contrato de locação"],
    brainHints: ["imobiliário"],
  },
  sections: [
    {
      id: "contrato",
      title: "1. Contrato e partes",
      fields: [
        { id: "landlord", label: "Locador (nome)", kind: "text", required: true, blocker: true },
        { id: "tenant", label: "Locatário (nome)", kind: "text", required: true, blocker: true },
        { id: "address", label: "Endereço do imóvel", kind: "text", required: true, blocker: true },
      ],
    },
    {
      id: "inadimplencia",
      title: "2. Inadimplência e provas",
      fields: [
        { id: "arrears", label: "Meses em atraso / valores", kind: "long_text", required: true, blocker: true },
        { id: "contract_doc", label: "Contrato de locação (tem?)", kind: "boolean", required: true, blocker: true },
      ],
    },
  ],
};

