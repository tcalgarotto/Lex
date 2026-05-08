/**
 * Domain Packs jurídicos.
 *
 * Cada pack descreve uma área do direito com:
 *  - normas obrigatórias para retrieval ter contexto mínimo
 *  - tribunais preferenciais para boost de jurisprudência
 *  - queries seed para popular corpus
 *  - hints determinísticos para issue-spotting / risk / drafting
 *
 * Usado por:
 *  - `corpus:seed:lexml` (filtra LEXML_SEED_QUERIES por área)
 *  - retrieval (boosts e filtros)
 *  - strategy analyzer (hints)
 *  - case workflow (templates)
 *
 * Princípio: 100% determinístico, zero LLM. LLM consome esses hints depois.
 */

import type { NormKind } from "@prisma/client";

export type DomainPackId =
  | "civil"
  | "contratos"
  | "contencioso"
  | "extrajudicial"
  | "familia"
  | "previdenciario"
  | "trabalho"
  | "crianca-adolescente"
  | "idoso"
  | "maria-da-penha"
  | "defesa-homem-maria-da-penha"
  | "representacao-mulher"
  | "advocacia-etica-prerrogativas"
  | "constitucional";

export type DomainPack = {
  id: DomainPackId;
  label: string;
  area: string;
  /** Síntese curta para tooltips/admin. */
  description: string;
  /** Queries seed que o `corpus:seed:lexml` deve disparar para esta área. */
  seedQueries: string[];
  /** URN-LEX (ou identifier humano) das normas obrigatórias para o pack. */
  requiredNorms: Array<{
    label: string;
    urn?: string;
    identifier?: string;
    kind: NormKind;
  }>;
  /** Tribunais que recebem boost no retrieval. */
  preferredTribunals: string[];
  /** Multiplicadores/boosts aplicados em retrieval. */
  retrievalBoosts: {
    /** Multiplicador adicional sobre score quando `kind` bate. */
    kindMultipliers?: Partial<Record<NormKind, number>>;
    /** Quanto somar ao score base por tribunal preferido. */
    tribunalBonus?: number;
  };
  /** Issues a procurar automaticamente em cada caso desta área. */
  issueSpottingHints: string[];
  /** Riscos típicos a marcar. */
  riskHints: string[];
  /** Sugestões de redação (hints de prompt). */
  draftingHints: string[];
  /** Templates de pesquisa (seedQueries para Research Engine). */
  researchTemplates: string[];
  /** Fontes prioritárias para esta área. */
  prioritySources: Array<"LEXML" | "STF" | "STJ" | "DATAJUD" | "CAMARA" | "SENADO">;
};

const DOMAIN_PACKS: ReadonlyArray<DomainPack> = [
  {
    id: "civil",
    label: "Direito Civil",
    area: "civil",
    description: "Relações privadas — pessoa, bens, obrigações, contratos, responsabilidade civil.",
    seedQueries: [
      "Código Civil Lei 10406 2002",
      "responsabilidade civil dano moral",
      "obrigação solidária",
    ],
    requiredNorms: [
      { label: "Código Civil", identifier: "Lei nº 10.406/2002", kind: "ORDINARY_LAW" },
      { label: "CPC", identifier: "Lei nº 13.105/2015", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP", "TJRJ", "TJMG", "TJRS"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.2, JURISPRUDENCE_STJ: 1.3 },
      tribunalBonus: 0.05,
    },
    issueSpottingHints: [
      "responsabilidade civil objetiva vs subjetiva",
      "dano moral, material, estético",
      "prescrição (CC art. 205, 206)",
      "boa-fé objetiva (CC art. 422)",
    ],
    riskHints: ["prescrição iminente", "ausência de nexo causal", "tese minoritária"],
    draftingHints: [
      "fundamentar com STJ recente",
      "trazer doutrina apenas se sumária",
      "estruturar pedidos por valor (principal/acessório)",
    ],
    researchTemplates: ["responsabilidade civil + tema", "dano moral + tribunal"],
    prioritySources: ["LEXML", "STJ", "DATAJUD"],
  },
  {
    id: "contratos",
    label: "Contratos",
    area: "contratos",
    description: "Formação, interpretação, vícios, inadimplemento, locação, prestação de serviço.",
    seedQueries: [
      "Código Civil contratos",
      "Lei do Inquilinato 8245 1991",
      "Código de Defesa do Consumidor relação consumo",
    ],
    requiredNorms: [
      { label: "Código Civil", identifier: "Lei nº 10.406/2002", kind: "ORDINARY_LAW" },
      { label: "CDC", identifier: "Lei nº 8.078/1990", kind: "ORDINARY_LAW" },
      { label: "Lei do Inquilinato", identifier: "Lei nº 8.245/1991", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP", "TJRS", "TJMG"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.2, JURISPRUDENCE_STJ: 1.25 },
      tribunalBonus: 0.05,
    },
    issueSpottingHints: [
      "cláusula abusiva (CDC art. 51)",
      "vício redibitório vs erro substancial",
      "rescisão por inadimplemento",
    ],
    riskHints: ["cláusula nula", "consumidor vs civil — regime aplicável"],
    draftingHints: [
      "qualificar regime: civil/CDC/empresarial",
      "fundamentar boa-fé objetiva",
      "demonstrar onerosidade excessiva quando cabível",
    ],
    researchTemplates: ["rescisão contratual + STJ", "cláusula abusiva + CDC"],
    prioritySources: ["LEXML", "STJ"],
  },
  {
    id: "contencioso",
    label: "Contencioso (CPC)",
    area: "contencioso",
    description: "Processo civil, recursos, tutela, execução, coisa julgada.",
    seedQueries: [
      "Código de Processo Civil Lei 13105 2015",
      "tutela de urgência cautelar",
      "embargos declaração",
    ],
    requiredNorms: [
      { label: "CPC", identifier: "Lei nº 13.105/2015", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "STF", "TJSP", "TJRJ", "TJMG"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.3, SUMULA_STJ: 1.3, JURISPRUDENCE_STJ: 1.2 },
      tribunalBonus: 0.07,
    },
    issueSpottingHints: [
      "preclusão",
      "tempestividade recursal",
      "cabimento (art. 1.022 CPC para EDcl)",
      "tutela de urgência (art. 300 CPC)",
    ],
    riskHints: ["intempestividade", "ausência de prequestionamento", "deserção"],
    draftingHints: [
      "abrir com cabimento + prazo",
      "sempre citar súmula aplicável",
      "fundamentar tutela com perigo + probabilidade",
    ],
    researchTemplates: ["tutela urgência + STJ", "embargos declaração omissão"],
    prioritySources: ["LEXML", "STJ", "STF", "DATAJUD"],
  },
  {
    id: "extrajudicial",
    label: "Extrajudicial / Notarial",
    area: "extrajudicial",
    description: "Registros públicos, escrituras, inventário e divórcio extrajudicial.",
    seedQueries: [
      "Lei de Registros Públicos 6015 1973",
      "inventário extrajudicial",
    ],
    requiredNorms: [
      { label: "LRP", identifier: "Lei nº 6.015/1973", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP"],
    retrievalBoosts: { kindMultipliers: { ORDINARY_LAW: 1.2 } },
    issueSpottingHints: ["necessidade de via judicial?", "qualificação registral"],
    riskHints: ["inventário com herdeiro incapaz exige judicial"],
    draftingHints: ["pormenorizar requisitos do art. 610 CPC"],
    researchTemplates: ["inventário extrajudicial requisitos"],
    prioritySources: ["LEXML", "STJ"],
  },
  {
    id: "familia",
    label: "Família e Sucessões",
    area: "familia",
    description: "Casamento, união estável, divórcio, alimentos, guarda, sucessões.",
    seedQueries: ["Código Civil família", "Lei de Alimentos 5478 1968"],
    requiredNorms: [
      { label: "Código Civil", identifier: "Lei nº 10.406/2002", kind: "ORDINARY_LAW" },
      { label: "Lei de Alimentos", identifier: "Lei nº 5.478/1968", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP", "TJRJ", "TJMG", "TJRS"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.2, JURISPRUDENCE_STJ: 1.3 },
      tribunalBonus: 0.05,
    },
    issueSpottingHints: [
      "guarda compartilhada como regra (art. 1.584 CC)",
      "trinômio alimentos (art. 1.694 CC)",
      "regime de bens",
    ],
    riskHints: ["alimentos retroativos", "alienação parental"],
    draftingHints: ["sempre quantificar binômio necessidade/possibilidade"],
    researchTemplates: ["guarda compartilhada + STJ", "alimentos avoengos"],
    prioritySources: ["LEXML", "STJ"],
  },
  {
    id: "previdenciario",
    label: "Direito Previdenciário",
    area: "previdenciario",
    description: "RGPS, benefícios INSS, aposentadoria, BPC, revisão.",
    seedQueries: [
      "Lei 8213 1991 benefícios previdenciários",
      "aposentadoria especial",
    ],
    requiredNorms: [
      { label: "Lei de Benefícios", identifier: "Lei nº 8.213/1991", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.3, JURISPRUDENCE_STJ: 1.3 },
      tribunalBonus: 0.1,
    },
    issueSpottingHints: ["DIB", "DER", "carência", "prévio requerimento administrativo"],
    riskHints: ["prescrição quinquenal", "cessação por revisão administrativa"],
    draftingHints: [
      "narrativa cronológica de vínculos",
      "demonstrar tempo especial com PPP/LTCAT",
    ],
    researchTemplates: ["aposentadoria especial + atividade", "BPC + miserabilidade"],
    prioritySources: ["LEXML", "STJ", "DATAJUD"],
  },
  {
    id: "trabalho",
    label: "Direito do Trabalho",
    area: "trabalho",
    description: "Vínculo, jornada, verbas rescisórias, dano moral trabalhista.",
    seedQueries: ["CLT 5452 1943", "horas extras adicional noturno"],
    requiredNorms: [
      { label: "CLT", identifier: "Decreto-Lei nº 5.452/1943", kind: "DECREE_LAW" },
    ],
    preferredTribunals: ["TST", "TRT12"],
    retrievalBoosts: {
      kindMultipliers: { DECREE_LAW: 1.3, JURISPRUDENCE_TST: 1.3 },
      tribunalBonus: 0.1,
    },
    issueSpottingHints: ["enquadramento sindical", "rescisão indireta", "vínculo PJ"],
    riskHints: ["prescrição bienal e quinquenal", "compensação de jornada"],
    draftingHints: ["sempre liquidar pedidos (art. 840 CLT)"],
    researchTemplates: ["vínculo PJ + TST", "dano moral trabalhista"],
    prioritySources: ["LEXML", "DATAJUD"],
  },
  {
    id: "crianca-adolescente",
    label: "Criança e Adolescente",
    area: "crianca-adolescente",
    description: "ECA, medidas socioeducativas, guarda, adoção.",
    seedQueries: ["Estatuto da Criança e Adolescente Lei 8069 1990"],
    requiredNorms: [
      { label: "ECA", identifier: "Lei nº 8.069/1990", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP", "TJRJ"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.3, JURISPRUDENCE_STJ: 1.3 },
    },
    issueSpottingHints: ["melhor interesse da criança", "intervenção MP obrigatória"],
    riskHints: ["risco à integridade do menor", "competência do Juiz da Infância"],
    draftingHints: ["fundamentar com art. 227 CF"],
    researchTemplates: ["adoção unilateral + STJ"],
    prioritySources: ["LEXML", "STJ"],
  },
  {
    id: "idoso",
    label: "Estatuto do Idoso",
    area: "idoso",
    description: "Direitos do idoso, prioridades, medidas protetivas.",
    seedQueries: ["Estatuto do Idoso Lei 10741 2003"],
    requiredNorms: [
      { label: "Estatuto do Idoso", identifier: "Lei nº 10.741/2003", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "TJSP"],
    retrievalBoosts: { kindMultipliers: { ORDINARY_LAW: 1.3 } },
    issueSpottingHints: ["prioridade processual", "violência financeira"],
    riskHints: ["abuso patrimonial", "internação compulsória inadequada"],
    draftingHints: ["pedir prioridade na distribuição"],
    researchTemplates: ["prioridade idoso + STJ"],
    prioritySources: ["LEXML", "STJ"],
  },
  {
    id: "maria-da-penha",
    label: "Lei Maria da Penha (mulher)",
    area: "maria-da-penha",
    description: "Medidas protetivas, violência doméstica, suporte à vítima mulher.",
    seedQueries: ["Lei Maria da Penha 11340 2006"],
    requiredNorms: [
      { label: "Lei Maria da Penha", identifier: "Lei nº 11.340/2006", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STJ", "STF", "TJSP", "TJRJ"],
    retrievalBoosts: {
      kindMultipliers: { ORDINARY_LAW: 1.3, SUMULA_VINCULANTE: 1.4, JURISPRUDENCE_STF: 1.3 },
      tribunalBonus: 0.1,
    },
    issueSpottingHints: ["medida protetiva de urgência", "proibição de contato"],
    riskHints: ["risco iminente à vítima", "descumprimento de protetiva"],
    draftingHints: ["sempre arrolar medidas protetivas adequadas"],
    researchTemplates: ["medida protetiva + descumprimento"],
    prioritySources: ["LEXML", "STJ", "STF"],
  },
  {
    id: "defesa-homem-maria-da-penha",
    label: "Defesa em Maria da Penha",
    area: "defesa-homem-maria-da-penha",
    description: "Defesa técnica em ações sob a Lei Maria da Penha.",
    seedQueries: ["Lei Maria da Penha defesa contraditório"],
    requiredNorms: [
      { label: "Lei Maria da Penha", identifier: "Lei nº 11.340/2006", kind: "ORDINARY_LAW" },
      { label: "CPP", identifier: "Decreto-Lei nº 3.689/1941", kind: "DECREE_LAW" },
    ],
    preferredTribunals: ["STJ", "STF", "TJSP"],
    retrievalBoosts: { kindMultipliers: { ORDINARY_LAW: 1.2 } },
    issueSpottingHints: ["devido processo", "cabimento HC contra protetiva"],
    riskHints: ["alegação genérica sem materialidade"],
    draftingHints: ["sempre tratar a vítima com respeito processual"],
    researchTemplates: ["medida protetiva + revogação"],
    prioritySources: ["LEXML", "STJ", "STF"],
  },
  {
    id: "representacao-mulher",
    label: "Representação da Mulher",
    area: "representacao-mulher",
    description: "Atuação ofensiva em violência de gênero, igualdade, assédio.",
    seedQueries: ["assédio moral mulher", "discriminação gênero trabalho"],
    requiredNorms: [
      { label: "Lei Maria da Penha", identifier: "Lei nº 11.340/2006", kind: "ORDINARY_LAW" },
      { label: "Constituição Federal", identifier: "CF/88", kind: "CONSTITUTION" },
    ],
    preferredTribunals: ["STF", "STJ", "TST"],
    retrievalBoosts: { tribunalBonus: 0.07 },
    issueSpottingHints: ["assédio sexual", "diferença salarial"],
    riskHints: ["dificuldade probatória", "retaliação"],
    draftingHints: ["sustentar com tratados internacionais (Convenção Belém do Pará)"],
    researchTemplates: ["assédio sexual trabalho + TST"],
    prioritySources: ["LEXML", "STF", "STJ"],
  },
  {
    id: "advocacia-etica-prerrogativas",
    label: "Advocacia, Ética e Prerrogativas",
    area: "advocacia-etica-prerrogativas",
    description: "Estatuto da Advocacia, Código de Ética, prerrogativas profissionais.",
    seedQueries: [
      "Estatuto da Advocacia Lei 8906 1994",
      "prerrogativas advogado violação",
    ],
    requiredNorms: [
      { label: "EOAB", identifier: "Lei nº 8.906/1994", kind: "ORDINARY_LAW" },
    ],
    preferredTribunals: ["STF", "STJ"],
    retrievalBoosts: { kindMultipliers: { ORDINARY_LAW: 1.3 } },
    issueSpottingHints: ["sigilo profissional", "inviolabilidade do escritório"],
    riskHints: ["quebra de prerrogativa por autoridade"],
    draftingHints: ["sempre vincular ao art. 133 CF"],
    researchTemplates: ["prerrogativa advogado + STF"],
    prioritySources: ["LEXML", "STF", "STJ"],
  },
  {
    id: "constitucional",
    label: "Direito Constitucional",
    area: "constitucional",
    description: "Direitos fundamentais, controle de constitucionalidade, federalismo.",
    seedQueries: ["Constituição Federal 1988", "controle constitucionalidade"],
    requiredNorms: [
      { label: "Constituição Federal", identifier: "CF/88", kind: "CONSTITUTION" },
    ],
    preferredTribunals: ["STF"],
    retrievalBoosts: {
      kindMultipliers: { CONSTITUTION: 1.5, SUMULA_VINCULANTE: 1.4, JURISPRUDENCE_STF: 1.4 },
      tribunalBonus: 0.15,
    },
    issueSpottingHints: ["mínimo existencial", "reserva do possível", "horizontal eficácia"],
    riskHints: ["contradição com SV", "modulação de efeitos"],
    draftingHints: ["fundamentar com SV/temas de RG aplicáveis"],
    researchTemplates: ["repercussão geral + STF tema"],
    prioritySources: ["LEXML", "STF"],
  },
];

export const ALL_DOMAIN_PACKS: ReadonlyArray<DomainPack> = DOMAIN_PACKS;

/** Busca pack por id; null se não encontrado. */
export function getDomainPack(id: DomainPackId): DomainPack | null {
  return DOMAIN_PACKS.find((p) => p.id === id) ?? null;
}

/** Busca pack por área (alias do id). */
export function getDomainPackByArea(area: string): DomainPack | null {
  return DOMAIN_PACKS.find((p) => p.area === area) ?? null;
}

/** Lista ids para enums/UIs. */
export function listDomainPackIds(): DomainPackId[] {
  return DOMAIN_PACKS.map((p) => p.id);
}
