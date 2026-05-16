/**
 * Copy da landing pública — tom comercial jurídico (sem jargão de produto/infra).
 */

export const LANDING_CONTAINER =
  "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";

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
  "Organização por cliente e processo",
  "Biblioteca jurídica do escritório",
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

export const LANDING_FEATURES: ReadonlyArray<{
  id: string;
  title: string;
  description: string;
}> = [
  {
    id: "casos",
    title: "Gestão de casos e processos",
    description:
      "Cliente, processo, prazos e histórico reunidos para a equipe enxergar o que fazer em seguida.",
  },
  {
    id: "documentos",
    title: "Análise de documentos",
    description:
      "Leitura orientada ao caso: extraia pontos sensíveis, fatos e trechos úteis sem perder o fio.",
  },
  {
    id: "pesquisa",
    title: "Pesquisa jurídica com fontes",
    description:
      "Encontre legislação, jurisprudência e fundamentos úteis sem perder o vínculo com a estratégia e a peça.",
  },
  {
    id: "estrategia",
    title: "Estratégia processual",
    description:
      "Organize linhas de atuação a partir do que o caso já tem de documentos e fundamentos aprovados.",
  },
  {
    id: "pecas",
    title: "Minutas e peças",
    description:
      "Rascunhos iniciais conectados ao caso, prontos para você revisar, ajustar e exportar.",
  },
  {
    id: "biblioteca",
    title: "Biblioteca do escritório",
    description:
      "Leis, códigos, modelos e memória jurídica do escritório sempre à mão para a equipe.",
  },
  {
    id: "equipe",
    title: "Organização da equipe",
    description:
      "Papéis definidos, histórico compartilhado e padrão de entrega mais previsível.",
  },
  {
    id: "historico",
    title: "Histórico e próximos passos",
    description:
      "Veja o que já foi feito no caso e o que ainda precisa de atenção antes do prazo.",
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
