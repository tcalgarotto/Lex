import type { ChecklistTemplate } from "../registry";

export const BANK_CHARGEBACK_CHECKLIST: ChecklistTemplate = {
  id: "consumidor.banco.cobranca_indevida",
  label: "Consumidor — cobrança indevida/chargeback (banco/cartão)",
  version: 1,
  area: ["Consumidor", "Bancário"],
  triggers: {
    keywords: ["cartão", "chargeback", "compra", "fraude", "cobrança indevida", "banco", "estorno", "fatura"],
    brainHints: ["consumidor", "bancário"],
  },
  sections: [
    {
      id: "ident",
      title: "1. Identificação",
      fields: [
        { id: "client_name", label: "Nome do cliente", kind: "text", required: true, blocker: true },
        { id: "bank", label: "Banco/emissor do cartão", kind: "text", required: true, blocker: true },
      ],
    },
    {
      id: "event",
      title: "2. O que aconteceu",
      fields: [
        { id: "transaction", label: "Compra/transação contestada (descrição)", kind: "long_text", required: true, blocker: true },
        { id: "amount", label: "Valor aproximado", kind: "text", required: false },
        { id: "date", label: "Data aproximada", kind: "text", required: false },
        { id: "protocol", label: "Protocolo de atendimento / reclamação", kind: "text", required: false },
      ],
    },
    {
      id: "docs",
      title: "3. Provas",
      fields: [
        { id: "invoice", label: "Fatura/print com a cobrança (tem?)", kind: "boolean", required: true, blocker: true },
        { id: "complaint", label: "Boletim de ocorrência (se fraude)", kind: "boolean", required: false },
      ],
    },
  ],
};

