/**
 * Jornadas sentinela copiáveis para o roteiro `/test-guide`.
 * Mantido em lib para uso por Server + Client sem duplicar dados.
 */
export const SENTINEL_JOURNEYS = [
  {
    id: "creche",
    label: "Creche (Educação infantil)",
    relato:
      "Autora: Ana Silva 111.222.333-44\nRéu: Município X\n\nCriança de 4 anos sem vaga em creche pública. Pedido de matrícula imediata. Urgência por risco de perda de trabalho da mãe e desenvolvimento da criança.",
    queries: [
      "vaga em creche direito da criança",
      "educação infantil em creche dever do Estado art. 208 IV",
    ],
    expect: ["Art. 208", "Art. 205", "Art. 227"],
  },
  {
    id: "medicamento",
    label: "Medicamento (Direito à saúde)",
    relato:
      "Autora: Joana 111.222.333-44\nRéu: Estado Y\n\nPaciente com prescrição médica para medicamento de alto custo. SUS negou fornecimento. Pedido de fornecimento imediato com urgência.",
    queries: ["direito à saúde dever do Estado", "SUS fornecimento de medicamento art 196"],
    expect: ["Art. 196", "Art. 198"],
  },
  {
    id: "banco",
    label: "Banco (Consumidor / cobrança indevida)",
    relato:
      "Autor: Carlos 111.222.333-44\nRéu: Banco Z\n\nCobrança indevida em cartão de crédito apesar de contestação. Pedido de suspensão da cobrança e indenização.",
    queries: ["defesa do consumidor constituição", "cobrança indevida relação de consumo fundamentos"],
    expect: ["Art. 170", "Art. 5"],
  },
  {
    id: "contrato",
    label: "Contrato (boa-fé / inadimplemento)",
    relato:
      "Autor: Maria Souza 111.222.333-44\nRéu: Empresa ABC Ltda\n\nContrato de prestação de serviços. A ré deixou de prestar o serviço. Pedido de rescisão e ressarcimento com urgência para cessar cobrança.",
    queries: ["ato jurídico perfeito direito adquirido", "boa-fé objetiva contrato (base constitucional)"],
    expect: ["Art. 5"],
  },
  {
    id: "concurso",
    label: "Concurso (Administração Pública)",
    relato:
      "Autor: Pedro 111.222.333-44\nRéu: Estado/Órgão Público\n\nCandidato aprovado dentro das vagas. Administração não nomeou. Pedido de nomeação e posse.",
    queries: ["concurso público princípios da administração pública", "legalidade impessoalidade moralidade publicidade eficiência art 37"],
    expect: ["Art. 37"],
  },
  {
    id: "locacao",
    label: "Locação (Moradia / mínimo existencial)",
    relato:
      "Autora: Paula 111.222.333-44\nRéu: Locador\n\nAmeaça de despejo e discussão sobre pagamentos. Pedido de tutela para manter posse até decisão.",
    queries: ["direitos sociais moradia art 6", "acesso à justiça lesão ou ameaça a direito art 5"],
    expect: ["Art. 6", "Art. 5"],
  },
] as const;

export type SentinelJourney = (typeof SENTINEL_JOURNEYS)[number];
