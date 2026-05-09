import type { ChecklistTemplate } from "../registry";

/**
 * Checklist genérico offline — sempre disponível.
 * Objetivo: funcionar como "modo degradado" quando a IA não consegue sugerir domínio.
 */
export const GENERIC_OFFLINE_CHECKLIST: ChecklistTemplate = {
  id: "generic.offline.intake",
  label: "Entrevista guiada — genérica (offline)",
  version: 1,
  area: ["Geral"],
  triggers: {
    keywords: [],
    brainHints: [],
  },
  sections: [
    {
      id: "core",
      title: "1. Essenciais do caso",
      description: "O mínimo para começar a estruturar partes, fatos e pedidos com segurança.",
      fields: [
        { id: "assisted_name", label: "Nome do cliente (parte assistida)", kind: "text", required: true, blocker: true },
        { id: "assisted_document", label: "CPF/CNPJ do cliente (se houver)", kind: "text", required: false },
        { id: "assisted_contact", label: "Telefone/E-mail do cliente", kind: "text", required: false },
        { id: "opposing_name", label: "Parte contrária (nome)", kind: "text", required: false },
        { id: "opposing_document", label: "CPF/CNPJ da parte contrária (se houver)", kind: "text", required: false },
        { id: "case_summary", label: "Resumo em 2-3 frases (texto livre)", kind: "long_text", required: true, blocker: true },
      ],
    },
    {
      id: "facts",
      title: "2. Linha do tempo (fatos)",
      fields: [
        { id: "fact_1", label: "Fato 1 (o que aconteceu?)", kind: "long_text", required: true, blocker: true },
        { id: "fact_2", label: "Fato 2 (continuação)", kind: "long_text", required: false },
        { id: "key_dates", label: "Datas relevantes (se houver)", kind: "text", required: false },
        { id: "place", label: "Local (cidade/UF) e contexto", kind: "text", required: false },
      ],
    },
    {
      id: "requests",
      title: "3. Objetivo e pedidos",
      fields: [
        { id: "goal", label: "Qual é o objetivo do cliente?", kind: "long_text", required: true, blocker: true },
        { id: "main_request", label: "Pedido principal (como você formularia?)", kind: "long_text", required: true, blocker: true },
        { id: "urgency", label: "Há urgência/risco? Qual?", kind: "long_text", required: false },
        { id: "estimated_value", label: "Valor envolvido (se aplicável)", kind: "text", required: false },
      ],
    },
    {
      id: "evidence",
      title: "4. Provas e documentos",
      fields: [
        { id: "docs_have", label: "Documentos que a cliente já tem", kind: "long_text", required: false },
        { id: "docs_missing", label: "Documentos que ainda precisamos pedir", kind: "long_text", required: false },
      ],
    },
    {
      id: "notes",
      title: "5. Observações",
      fields: [{ id: "notes", label: "Observações livres", kind: "long_text", required: false }],
    },
  ],
};

