/**
 * Copy da landing pública — tom comercial jurídico.
 */

/** Header e footer: largura total da viewport. */
export const LANDING_SHELL_FULL = "w-full";

/** Conteúdo da página: ~80% da tela, centralizado. */
export const LANDING_CONTENT =
  "mx-auto w-[min(100%,80vw)] max-w-[1180px] px-4 sm:px-5 md:px-6";

/** Barra interna do header/footer (edge-to-edge com padding generoso). */
export const LANDING_BAR_INNER = "mx-auto w-full px-4 sm:px-8 lg:px-12 xl:px-16";

export const LANDING_NAV = [
  { href: "#inicio", label: "Início" },
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-escritorios", label: "Para escritórios" },
  { href: "#seguranca", label: "Segurança" },
] as const;

export const LANDING_HERO = {
  badge: "Plataforma jurídica inteligente",
  title: "Organize seus casos, encontre fundamentos e produza peças com mais segurança.",
  subtitle:
    "O Lex ajuda advogados e escritórios a transformar documentos, relatos e pesquisa jurídica em estratégia, minutas e decisões melhor fundamentadas.",
  microcopy:
    "Feito para a rotina real da advocacia: documentos, prazos, fundamentos, clientes e peças no mesmo lugar.",
  ctaPrimary: "Solicitar acesso",
  ctaSecondary: "Ver como funciona",
} as const;

export const LANDING_TRUST_STRIP = [
  "Para advogados autônomos",
  "Para escritórios",
  "Para equipes jurídicas",
  "Com revisão profissional",
  "Com pesquisa fundamentada",
] as const;

export const LANDING_PROOF_POINTS = [
  "Pesquisa com fontes",
  "Minutas conectadas ao caso",
  "Agenda e prazos visíveis",
  "Acervo de leis e normas",
  "Revisão profissional no centro",
] as const;

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
    tag: "IA nativa",
    description:
      "Converse com o caso aberto: peça resumos, próximos passos e rascunhos sem perder o contexto do cliente.",
    example: "Ex.: “Quais cláusulas do contrato merecem destaque na contestação?”",
  },
  {
    id: "casos",
    title: "Fluxo completo do caso",
    description:
      "Da entrevista inicial à peça: partes, fatos, pedidos, riscos e linha do tempo em um único painel.",
    example: "Ex.: caso trabalhista com 14 fatos extraídos e estratégia em revisão.",
  },
  {
    id: "documentos",
    title: "Documentos na nuvem do escritório",
    description:
      "Envie PDFs e anexos com segurança; leia, destaque trechos e use o material direto na minuta.",
    example: "Ex.: 8 documentos no caso · 3 pontos sensíveis já sinalizados.",
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
    example: "Ex.: minuta da inicial 80% pronta · aguardando sua revisão final.",
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
    "O Lex apoia o trabalho jurídico. A decisão, a revisão e o protocolo continuam sempre com o profissional.",
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

export const LANDING_FINAL_CTA = {
  title: "Leve mais inteligência para a rotina do seu escritório.",
  description:
    "Entre na lista de acesso e veja como o Lex pode ajudar sua equipe a trabalhar com mais organização, velocidade e controle.",
  button: "Solicitar acesso",
} as const;

/** @deprecated use LANDING_CONTENT */
export const LANDING_CONTAINER = LANDING_CONTENT;
