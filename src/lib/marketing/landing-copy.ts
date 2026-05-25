/**
 * Copy da landing pública — tom advogado para advogado (JustOS).
 */

/** Header e footer: faixa de fundo em largura total. */
export const LANDING_SHELL_FULL = "w-full";

/** Padding horizontal alinhado ao app (`--lex-page-gap`). */
const MARKETING_GUTTER = "box-border px-[max(1.25rem,var(--lex-page-gap))]";

/** Ritmo vertical único das dobras marketing (home + /produto). */
export const LANDING_SECTION_PAD =
  "scroll-mt-[4.75rem] sm:scroll-mt-[5.25rem] py-14 md:py-16 lg:py-20";

/**
 * Conteúdo da página — 70% da viewport, centralizado.
 * Utilitários Tailwind + `.lex-marketing-well` (globals) para não depender só de uma camada.
 */
export const LANDING_CONTENT = [
  "lex-marketing-well",
  "mx-auto w-full min-w-0",
  MARKETING_GUTTER,
].join(" ");

/**
 * Header / footer (conteúdo interno) — até 96% da viewport.
 * Mais largo que o poço de 70% para nav e CTAs respirarem nas laterais.
 */
export const LANDING_BAR_INNER = [
  "lex-marketing-bar",
  "mx-auto w-full min-w-0",
  MARKETING_GUTTER,
].join(" ");

/** Nav principal — poucos itens; âncoras da home com `/` para funcionar em qualquer rota. */
export const LANDING_NAV = [
  { href: "/#pilares", label: "Pilares" },
  { href: "/produto", label: "Recursos" },
  { href: "/pricing", label: "Preços" },
] as const;

/** IDs observados para barra de progresso (todas as dobras principais). */
export const LANDING_HOME_SCROLL_SECTIONS = [
  { id: "inicio" },
  { id: "pilares" },
  { id: "beta" },
  { id: "intencao" },
  { id: "como-funciona" },
  { id: "seguranca" },
  { id: "compromissos" },
  { id: "faq" },
] as const;

/** FAQ marketing — tom advogado, sem promessas não verificáveis. */
export const LANDING_FAQ = [
  {
    id: "o-que-e",
    question: "O JustOS substitui o advogado?",
    answer:
      "Não. O JustOS organiza caso, documentos, pesquisa e minutas. A decisão, a revisão e o protocolo continuam sempre com o profissional habilitado.",
  },
  {
    id: "acesso",
    question: "Como solicito acesso ao JustOS?",
    answer:
      "Preencha o formulário nesta página ou agende uma demonstração. Analisamos cada pedido e respondemos por e-mail em alguns dias úteis.",
  },
  {
    id: "dados",
    question: "Meus dados e os do cliente ficam seguros?",
    answer:
      "Tratamos informações do escritório com acesso controlado e políticas de privacidade publicadas. Detalhes estão em /privacidade e nos termos de uso.",
  },
  {
    id: "integracoes",
    question: "Integra com tribunais e e-mail?",
    answer:
      "Há suporte a integrações conforme o plano e autorizações do escritório. Na demonstração mostramos o que está disponível para o seu fluxo.",
  },
  {
    id: "precos",
    question: "Quanto custa?",
    answer:
      "Os planos e limites estão na página de preços. Durante a fase de acesso antecipado, condições podem ser combinadas com a equipe.",
  },
] as const;

export const LANDING_HERO = {
  badge: "Sistema operacional do escritório",
  title: "Casos, fundamentos e minutas no mesmo fluxo — com revisão nas suas mãos.",
  subtitle:
    "O JustOS concentra documentos, pesquisa com fonte, agenda e peças no caso aberto. A assistência apoia; a decisão e o protocolo continuam com você.",
  microcopy:
    "Menos retrabalho entre atendimento, estratégia e minuta. Mais previsibilidade para o cliente e para a equipe.",
  ctaPrimary: "Solicitar acesso",
  ctaSecondary: "Ver como funciona",
} as const;

/** Compromissos públicos (substitui depoimentos até haver prova social verificável). */
export const LANDING_COMMITMENTS = [
  {
    title: "O advogado decide",
    description:
      "Sugestões e minutas são ponto de partida. Revisão, estratégia e protocolo permanecem com o profissional habilitado.",
  },
  {
    title: "Caso no centro",
    description:
      "Documentos, pesquisa e peça conversam no mesmo painel — sem perder o fio entre atendimento e minuta.",
  },
  {
    title: "Fontes visíveis",
    description:
      "Fundamentos chegam com referência para você validar antes de colar na peça ou protocolar.",
  },
] as const;

export const LANDING_PILLARS = [
  {
    title: "Caso no centro",
    description:
      "Cliente, processo, documentos e histórico no mesmo lugar — sem pastas soltas nem contexto perdido entre atendimentos.",
  },
  {
    title: "Fundamentos com fonte",
    description:
      "Pesquisa legislativa e jurisprudencial ligada à peça, com referência clara para você validar antes de protocolar.",
  },
  {
    title: "Minuta revisada por você",
    description:
      "Rascunhos conectados ao caso aberto. A assistência apoia; a decisão e o protocolo continuam nas suas mãos.",
  },
] as const;

/** Três passos resumidos na home (detalhe em /produto). */
export const LANDING_WORKFLOW_BRIEF = [
  {
    step: "1",
    title: "Organize o caso",
    description: "Cadastre cliente e processo, centralize documentos e o que importa para a estratégia.",
  },
  {
    step: "2",
    title: "Fundamente com clareza",
    description: "Pesquise com fontes visíveis e conectadas ao contexto — não um bloco de texto solto.",
  },
  {
    step: "3",
    title: "Redija e revise",
    description: "Parta de minuta ligada ao caso, ajuste com a equipe e protocole quando estiver seguro.",
  },
] as const;

export const LANDING_TRUST_STRIP = [
  "Para advogados autônomos",
  "Para escritórios",
  "Para equipes jurídicas",
] as const;

export const LANDING_PROOF_POINTS = [
  "Pesquisa com fontes",
  "Minutas conectadas ao caso",
  "Agenda e prazos visíveis",
  "Acervo de leis e normas",
  "Revisão profissional no centro",
] as const;

/** Uma dobra na home: dor → ganho (sem duplicar pilares). */
export const LANDING_INTENT = {
  title: "Conexão entre atendimento, estratégia e peça — sem trocar de ferramenta a cada etapa.",
  lead: "O JustOS existe para o escritório que já sabe advogar bem, mas perde horas reconectando contexto entre e-mail, pasta, pesquisa e minuta.",
  outcomes: [
    {
      pain: "Contexto espalhado",
      gain: "Um caso, um painel",
      detail: "Cliente, autos, pesquisa e histórico no mesmo lugar — sem pastas paralelas.",
    },
    {
      pain: "Pesquisa solta da peça",
      gain: "Fundamento com fonte",
      detail: "Legislação e jurisprudência ligadas ao que você vai protocolar, com referência clara.",
    },
    {
      pain: "Minuta genérica",
      gain: "Rascunho do seu caso",
      detail: "A assistência apoia a redação; a revisão e o protocolo continuam com você.",
    },
  ],
} as const;

export const LANDING_PROBLEM = {
  title: "Seu escritório não perde tempo por falta de capacidade. Perde por falta de conexão.",
  items: [
    "Documentos espalhados entre e-mail, pastas e mensagens.",
    "Informações do cliente sem estrutura clara.",
    "Pesquisa que não conversa com a peça.",
    "Modelos que não entendem o caso.",
    "Retrabalho entre atendimento, estratégia e minuta.",
    "Dificuldade de manter padrão entre a equipe.",
  ],
} as const;

export const LANDING_SOLUTION = {
  title: "Do relato do cliente à minuta: tudo conectado ao caso.",
  cards: [
    { title: "Entenda o caso", desc: "Partes, fatos, pedidos e histórico em um só lugar." },
    { title: "Organize documentos", desc: "Contratos, autos e anexos ligados ao que importa." },
    { title: "Encontre fundamentos", desc: "Legislação, súmulas e jurisprudência com fonte." },
    { title: "Defina estratégia", desc: "Linhas de atuação alinhadas aos fatos do cliente." },
    { title: "Produza minutas", desc: "Petições e pareceres com o contexto do caso." },
    { title: "Revise com controle", desc: "Você valida antes de protocolar ou enviar." },
  ],
} as const;

export type LandingFeature = {
  id: string;
  title: string;
  description: string;
  example: string;
  tag?: string;
};

export const LANDING_FEATURES: readonly LandingFeature[] = [
  {
    id: "native-ai",
    title: "Assistente jurídico no caso",
    tag: "No caso aberto",
    description:
      "Converse com o caso aberto: peça resumos, próximos passos e rascunhos sem perder o contexto do cliente.",
    example: "Ex.: “Quais cláusulas do contrato merecem destaque na contestação?”",
  },
  {
    id: "casos",
    title: "Fluxo completo do caso",
    description:
      "Da entrevista inicial à peça: partes, fatos, pedidos, riscos e linha do tempo em um único painel.",
    example: "Ex.: linha do tempo do caso com fatos, pedidos e estratégia em revisão.",
  },
  {
    id: "documentos",
    title: "Documentos do escritório",
    description:
      "Envie PDFs e anexos com segurança; leia, destaque trechos e use o material direto na minuta.",
    example: "Ex.: contratos e autos do caso reunidos para revisão da minuta.",
  },
  {
    id: "pesquisa",
    title: "Pesquisa jurídica com fontes",
    description:
      "Legislação, súmulas e jurisprudência úteis ao caso, com referência para colar na peça.",
    example: "Ex.: CC art. 186 e Súmula 331 STJ sugeridos para o pedido de danos.",
  },
  {
    id: "acervo",
    title: "Acervo de leis e normas",
    description:
      "Códigos, leis federais e normas consultáveis com trechos citáveis — sem sair do fluxo do caso.",
    example: "Ex.: busca por “rescisão indireta” com artigos prontos para fundamentar.",
  },
  {
    id: "livros",
    title: "Livros e leituras recomendadas",
    description:
      "Obras e materiais de referência do escritório organizados para apoiar pareceres e estratégias.",
    example: "Ex.: capítulo sobre responsabilidade civil vinculado ao caso em andamento.",
  },
  {
    id: "pecas",
    title: "Minutas e peças conectadas",
    description:
      "Petições, contestações e pareceres com rascunho inicial ligado aos fatos e fundamentos aprovados.",
    example: "Ex.: rascunho da inicial ligado aos fatos · aguardando sua revisão final.",
  },
  {
    id: "agenda",
    title: "Agenda interativa",
    description:
      "Audiências, prazos e compromissos do escritório na mesma visão dos casos que exigem ação.",
    example: "Ex.: audiência na terça · prazo de manifestação em 5 dias úteis.",
  },
  {
    id: "email",
    title: "E-mail integrado ao caso",
    description:
      "Troque mensagens com clientes e equipe sem perder o histórico do que foi combinado.",
    example: "Ex.: e-mail do cliente anexado ao caso com resumo do que foi pedido.",
  },
  {
    id: "integracoes",
    title: "Integrações com tribunais",
    description:
      "Acompanhe movimentações e documentos oficiais quando o escritório autoriza o acesso.",
    example: "Ex.: nova publicação no diário vinculada ao processo do cliente.",
  },
  {
    id: "site",
    title: "Site do escritório",
    description:
      "Página institucional alinhada à marca do escritório, pronta para captar contatos e reforçar credibilidade.",
    example: "Ex.: landing do escritório com formulário de consulta inicial.",
  },
  {
    id: "biblioteca",
    title: "Biblioteca e memória do escritório",
    description:
      "Modelos, fundamentos favoritos e decisões passadas reutilizáveis pela equipe.",
    example: "Ex.: modelo de petição inicial adaptado ao estilo do sócio.",
  },
] as const;

/** Agrupa features por ID (usado nas jornadas da página /produto). */
export function landingFeaturesByIds(ids: readonly string[]): LandingFeature[] {
  const set = new Set(ids);
  return LANDING_FEATURES.filter((f) => set.has(f.id));
}

export type LandingProductJourney = {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  narrative: string;
  featureIds: readonly string[];
  snippet: {
    chrome: string;
    headline: string;
    lines: readonly string[];
    footer?: string;
  };
};

/** Fase 4 — três histórias horizontais (Captação → Caso → Peça). */
export const LANDING_PRODUCT_JOURNEYS: readonly LandingProductJourney[] = [
  {
    id: "captacao",
    step: "1",
    title: "Captação",
    subtitle: "Do primeiro contato ao caso estruturado",
    narrative:
      "Cliente chega pelo site, e-mail ou consulta presencial. Você registra o relato, anexa o que já tem e abre o caso com contexto — sem planilha paralela.",
    featureIds: ["site", "email", "casos", "native-ai"],
    snippet: {
      chrome: "Novo contato · Consulta inicial",
      headline: "Entrevista guiada",
      lines: [
        "Cliente: Silva Comércio Ltda.",
        "Pedido: revisão de contrato de distribuição",
        "3 documentos já anexados",
      ],
      footer: "Próximo: estruturar fatos e partes",
    },
  },
  {
    id: "caso",
    step: "2",
    title: "Caso",
    subtitle: "Documentos, fatos e fundamentos no mesmo painel",
    narrative:
      "Tudo do processo fica ligado ao caso aberto: autos, pesquisa com fonte, prazos na agenda e movimentações quando integradas. A equipe enxerga o mesmo histórico.",
    featureIds: ["documentos", "pesquisa", "acervo", "agenda", "integracoes", "biblioteca"],
    snippet: {
      chrome: "Caso #2847 · Revisão contratual",
      headline: "Pesquisa com fonte",
      lines: [
        "CC art. 421 — função social do contrato",
        "Súmula 331 STJ — relação de consumo",
        "8 documentos · 14 fatos validados",
      ],
      footer: "Fundamentos prontos para colar na peça",
    },
  },
  {
    id: "peca",
    step: "3",
    title: "Peça",
    subtitle: "Minuta conectada ao caso — revisão nas suas mãos",
    narrative:
      "A minuta parte do que já foi validado no caso. Você ajusta linguagem, estratégia e fundamentos antes de protocolar. A assistência apoia; a decisão é sua.",
    featureIds: ["pecas", "pesquisa", "native-ai", "livros", "biblioteca"],
    snippet: {
      chrome: "Minuta · Contestação",
      headline: "Rascunho em revisão",
      lines: [
        "80% ligado aos fatos aprovados",
        "6 fundamentos citados com referência",
        "Aguardando revisão do advogado",
      ],
      footer: "Você protocola quando estiver seguro",
    },
  },
] as const;

export const LANDING_WORKFLOW = [
  {
    step: "1",
    title: "Cadastre ou crie um caso",
    description: "Centralize cliente, processo e contexto desde o primeiro contato.",
  },
  {
    step: "2",
    title: "Adicione documentos e relatos",
    description: "Contratos, autos e anotações alimentam a visão do caso.",
  },
  {
    step: "3",
    title: "Veja fatos, partes e pontos de atenção",
    description: "Organize o que importa antes de pesquisar ou escrever.",
  },
  {
    step: "4",
    title: "Pesquise fundamentos",
    description: "Legislação e jurisprudência com referência clara para a peça.",
  },
  {
    step: "5",
    title: "Gere uma minuta inicial",
    description: "Parta de um rascunho conectado ao caso, não de um modelo vazio.",
  },
  {
    step: "6",
    title: "Revise, ajuste e siga com segurança",
    description: "A decisão e o protocolo continuam sempre com o profissional.",
  },
] as const;

export const LANDING_AUDIENCE = [
  {
    title: "Advogado autônomo",
    description:
      "Ganhe organização, reduza retrabalho e leve pesquisa e minuta no mesmo fluxo — com você no controle.",
  },
  {
    title: "Escritório em crescimento",
    description:
      "Padronize entregas, acelere análise de documentos e mantenha histórico claro por cliente.",
  },
  {
    title: "Sócio gestor",
    description:
      "Visão do que a equipe produz, com mais previsibilidade entre atendimento, estratégia e peças.",
  },
  {
    title: "Equipe jurídica",
    description:
      "Todos trabalham no mesmo caso, com fundamentos, documentos e minutas alinhados.",
  },
] as const;

export const LANDING_SECURITY = {
  title: "Tecnologia para apoiar o advogado, não para substituir sua decisão.",
  description:
    "O JustOS organiza o trabalho jurídico. A decisão, a revisão e o protocolo continuam sempre com o profissional habilitado.",
  points: [
    {
      title: "Revisão profissional",
      desc: "Minutas e sugestões são ponto de partida — nunca entrega final automática.",
    },
    {
      title: "Fontes e histórico",
      desc: "Saiba de onde veio cada fundamento sugerido e o que já foi validado no caso.",
    },
    {
      title: "Organização segura",
      desc: "Informações do cliente e do escritório tratadas com cuidado e acesso controlado.",
    },
    {
      title: "Controle de acesso",
      desc: "Defina quem na equipe vê e edita cada caso ou documento.",
    },
    {
      title: "Cuidado com dados do cliente",
      desc: "Pensado para a sensibilidade do material jurídico do dia a dia.",
    },
  ],
} as const;

/** Bullets de segurança na home (lista completa em /produto). */
export const LANDING_SECURITY_BRIEF = LANDING_SECURITY.points.slice(0, 3);

export const LANDING_FINAL_CTA = {
  title: "Organize o escritório sem perder o controle da peça.",
  description:
    "Solicite acesso ao JustOS e veja como centralizar caso, fundamento e minuta com a equipe no mesmo painel.",
  button: "Solicitar acesso",
} as const;

/** @deprecated use LANDING_CONTENT */
export const LANDING_CONTAINER = LANDING_CONTENT;
