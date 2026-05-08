/**
 * Corpus jurídico mínimo verificado manualmente.
 *
 * Cada item aqui foi conferido contra a fonte oficial (Planalto/STF) e
 * mantém o texto literal. Não há texto inventado, demo ou de explicação
 * de sistema.
 *
 * Uso:
 *   - `scripts/corpus-seed-minimal-legal.ts` lê este arquivo, monta
 *     `CorpusPayload` e chama `upsertCorpusPayload({ provider: MANUAL })`.
 *   - Depois disso, o pipeline de embeddings indexa cada `LegalNormVersion`
 *     na collection correta do Qdrant (legislação → `lex_corpus_norms`).
 */

import { NormKind } from "@prisma/client";

export type MinimalLegalNorm = {
  /** URN canônica — gerada via buildCanonicalUrn pra evitar typos. */
  urnInput: {
    authority: string;
    documentType: string;
    date: string; // yyyy-mm-dd
    number: string;
  };
  kind: NormKind;
  title: string;
  identifier: string;
  authorityName: string;
  publishedAt: string; // yyyy-mm-dd
  sourceUrl: string;
  /** Texto bruto de toda a norma (concatenação dos artigos abaixo). */
  body: string;
};

/**
 * Helper para montar o `body` a partir de blocos curados.
 * Cada bloco vira um trecho separado com cabeçalho, o que ajuda
 * o chunker hierárquico (`chunkLegalNorm`) a segmentar por artigo.
 */
function buildBody(parts: Array<{ heading: string; text: string }>): string {
  return parts
    .map((p) => `${p.heading.trim()}\n${p.text.trim()}`)
    .join("\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Constituição Federal (1988)
// ---------------------------------------------------------------------------

const CF_PARTS = [
  {
    heading: "Art. 5º",
    text:
      "Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:\n" +
      "I - homens e mulheres são iguais em direitos e obrigações, nos termos desta Constituição;\n" +
      "II - ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei;\n" +
      "XXXV - a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito;\n" +
      "LIV - ninguém será privado da liberdade ou de seus bens sem o devido processo legal;\n" +
      "LV - aos litigantes, em processo judicial ou administrativo, e aos acusados em geral são assegurados o contraditório e ampla defesa, com os meios e recursos a ela inerentes;\n" +
      "LXXVIII - a todos, no âmbito judicial e administrativo, são assegurados a razoável duração do processo e os meios que garantam a celeridade de sua tramitação.",
  },
  {
    heading: "Art. 37",
    text:
      "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte: (...)",
  },
  {
    heading: "Art. 93, IX",
    text:
      "todos os julgamentos dos órgãos do Poder Judiciário serão públicos, e fundamentadas todas as decisões, sob pena de nulidade, podendo a lei limitar a presença, em determinados atos, às próprias partes e a seus advogados, ou somente a estes, em casos nos quais a preservação do direito à intimidade do interessado no sigilo não prejudique o interesse público à informação.",
  },
];

// ---------------------------------------------------------------------------
// Código de Processo Civil (Lei 13.105/2015)
// ---------------------------------------------------------------------------

const CPC_PARTS = [
  {
    heading: "Art. 1º",
    text:
      "O processo civil será ordenado, disciplinado e interpretado conforme os valores e as normas fundamentais estabelecidos na Constituição da República Federativa do Brasil, observando-se as disposições deste Código.",
  },
  {
    heading: "Art. 319",
    text:
      "A petição inicial indicará:\n" +
      "I - o juízo a que é dirigida;\n" +
      "II - os nomes, os prenomes, o estado civil, a existência de união estável, a profissão, o número de inscrição no Cadastro de Pessoas Físicas ou no Cadastro Nacional da Pessoa Jurídica, o endereço eletrônico, o domicílio e a residência do autor e do réu;\n" +
      "III - o fato e os fundamentos jurídicos do pedido;\n" +
      "IV - o pedido com as suas especificações;\n" +
      "V - o valor da causa;\n" +
      "VI - as provas com que o autor pretende demonstrar a verdade dos fatos alegados;\n" +
      "VII - a opção do autor pela realização ou não de audiência de conciliação ou de mediação.",
  },
  {
    heading: "Art. 330",
    text:
      "A petição inicial será indeferida quando:\n" +
      "I - for inepta;\n" +
      "II - a parte for manifestamente ilegítima;\n" +
      "III - o autor carecer de interesse processual;\n" +
      "IV - não atendidas as prescrições dos arts. 106 e 321.\n" +
      "§ 1º Considera-se inepta a petição inicial quando:\n" +
      "I - lhe faltar pedido ou causa de pedir;\n" +
      "II - o pedido for indeterminado, ressalvadas as hipóteses legais em que se permite o pedido genérico;\n" +
      "III - da narração dos fatos não decorrer logicamente a conclusão;\n" +
      "IV - contiver pedidos incompatíveis entre si.",
  },
  {
    heading: "Art. 489",
    text:
      "São elementos essenciais da sentença:\n" +
      "I - o relatório, que conterá os nomes das partes, a identificação do caso, com a suma do pedido e da contestação, e o registro das principais ocorrências havidas no andamento do processo;\n" +
      "II - os fundamentos, em que o juiz analisará as questões de fato e de direito;\n" +
      "III - o dispositivo, em que o juiz resolverá as questões principais que as partes lhe submeterem.\n" +
      "§ 1º Não se considera fundamentada qualquer decisão judicial, seja ela interlocutória, sentença ou acórdão, que:\n" +
      "I - se limitar à indicação, à reprodução ou à paráfrase de ato normativo, sem explicar sua relação com a causa ou a questão decidida;\n" +
      "II - empregar conceitos jurídicos indeterminados, sem explicar o motivo concreto de sua incidência no caso;\n" +
      "III - invocar motivos que se prestariam a justificar qualquer outra decisão;\n" +
      "IV - não enfrentar todos os argumentos deduzidos no processo capazes de, em tese, infirmar a conclusão adotada pelo julgador;\n" +
      "V - se limitar a invocar precedente ou enunciado de súmula, sem identificar seus fundamentos determinantes nem demonstrar que o caso sob julgamento se ajusta àqueles fundamentos;\n" +
      "VI - deixar de seguir enunciado de súmula, jurisprudência ou precedente invocado pela parte, sem demonstrar a existência de distinção no caso em julgamento ou a superação do entendimento.",
  },
  {
    heading: "Art. 1.022",
    text:
      "Cabem embargos de declaração contra qualquer decisão judicial para:\n" +
      "I - esclarecer obscuridade ou eliminar contradição;\n" +
      "II - suprir omissão de ponto ou questão sobre o qual devia se pronunciar o juiz de ofício ou a requerimento;\n" +
      "III - corrigir erro material.\n" +
      "Parágrafo único. Considera-se omissa a decisão que:\n" +
      "I - deixe de se manifestar sobre tese firmada em julgamento de casos repetitivos ou em incidente de assunção de competência aplicável ao caso sob julgamento;\n" +
      "II - incorra em qualquer das condutas descritas no art. 489, § 1º.",
  },
];

// ---------------------------------------------------------------------------
// Código Civil (Lei 10.406/2002)
// ---------------------------------------------------------------------------

const CC_PARTS = [
  {
    heading: "Art. 186",
    text: "Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.",
  },
  {
    heading: "Art. 187",
    text: "Também comete ato ilícito o titular de um direito que, ao exercê-lo, excede manifestamente os limites impostos pelo seu fim econômico ou social, pela boa-fé ou pelos bons costumes.",
  },
  {
    heading: "Art. 389",
    text: "Não cumprida a obrigação, responde o devedor por perdas e danos, mais juros e atualização monetária segundo índices oficiais regularmente estabelecidos, e honorários de advogado.",
  },
  {
    heading: "Art. 421",
    text:
      "A liberdade contratual será exercida nos limites da função social do contrato.\n" +
      "Parágrafo único. Nas relações contratuais privadas, prevalecerá o princípio da intervenção mínima e a excepcionalidade da revisão contratual.",
  },
  {
    heading: "Art. 422",
    text: "Os contratantes são obrigados a guardar, assim na conclusão do contrato, como em sua execução, os princípios de probidade e boa-fé.",
  },
  {
    heading: "Art. 927",
    text:
      "Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo.\n" +
      "Parágrafo único. Haverá obrigação de reparar o dano, independentemente de culpa, nos casos especificados em lei, ou quando a atividade normalmente desenvolvida pelo autor do dano implicar, por sua natureza, risco para os direitos de outrem.",
  },
];

// ---------------------------------------------------------------------------
// Código de Defesa do Consumidor (Lei 8.078/1990)
// ---------------------------------------------------------------------------

const CDC_PARTS = [
  {
    heading: "Art. 6º",
    text:
      "São direitos básicos do consumidor:\n" +
      "I - a proteção da vida, saúde e segurança contra os riscos provocados por práticas no fornecimento de produtos e serviços considerados perigosos ou nocivos;\n" +
      "II - a educação e divulgação sobre o consumo adequado dos produtos e serviços, asseguradas a liberdade de escolha e a igualdade nas contratações;\n" +
      "III - a informação adequada e clara sobre os diferentes produtos e serviços, com especificação correta de quantidade, características, composição, qualidade, tributos incidentes e preço, bem como sobre os riscos que apresentem;\n" +
      "IV - a proteção contra a publicidade enganosa e abusiva, métodos comerciais coercitivos ou desleais, bem como contra práticas e cláusulas abusivas ou impostas no fornecimento de produtos e serviços;\n" +
      "VI - a efetiva prevenção e reparação de danos patrimoniais e morais, individuais, coletivos e difusos;\n" +
      "VII - o acesso aos órgãos judiciários e administrativos com vistas à prevenção ou reparação de danos patrimoniais e morais, individuais, coletivos ou difusos, assegurada a proteção Jurídica, administrativa e técnica aos necessitados;\n" +
      "VIII - a facilitação da defesa de seus direitos, inclusive com a inversão do ônus da prova, a seu favor, no processo civil, quando, a critério do juiz, for verossímil a alegação ou quando for ele hipossuficiente, segundo as regras ordinárias de experiências.",
  },
  {
    heading: "Art. 12",
    text:
      "O fabricante, o produtor, o construtor, nacional ou estrangeiro, e o importador respondem, independentemente da existência de culpa, pela reparação dos danos causados aos consumidores por defeitos decorrentes de projeto, fabricação, construção, montagem, fórmulas, manipulação, apresentação ou acondicionamento de seus produtos, bem como por informações insuficientes ou inadequadas sobre sua utilização e riscos.\n" +
      "§ 1º O produto é defeituoso quando não oferece a segurança que dele legitimamente se espera, levando-se em consideração as circunstâncias relevantes, entre as quais:\n" +
      "I - sua apresentação;\n" +
      "II - o uso e os riscos que razoavelmente dele se esperam;\n" +
      "III - a época em que foi colocado em circulação.",
  },
  {
    heading: "Art. 14",
    text:
      "O fornecedor de serviços responde, independentemente da existência de culpa, pela reparação dos danos causados aos consumidores por defeitos relativos à prestação dos serviços, bem como por informações insuficientes ou inadequadas sobre sua fruição e riscos.\n" +
      "§ 1º O serviço é defeituoso quando não fornece a segurança que o consumidor dele pode esperar, levando-se em consideração as circunstâncias relevantes, entre as quais:\n" +
      "I - o modo de seu fornecimento;\n" +
      "II - o resultado e os riscos que razoavelmente dele se esperam;\n" +
      "III - a época em que foi fornecido.\n" +
      "§ 4º A responsabilidade pessoal dos profissionais liberais será apurada mediante a verificação de culpa.",
  },
  {
    heading: "Art. 18",
    text:
      "Os fornecedores de produtos de consumo duráveis ou não duráveis respondem solidariamente pelos vícios de qualidade ou quantidade que os tornem impróprios ou inadequados ao consumo a que se destinam ou lhes diminuam o valor, assim como por aqueles decorrentes da disparidade, com as indicações constantes do recipiente, da embalagem, rotulagem ou mensagem publicitária, respeitadas as variações decorrentes de sua natureza, podendo o consumidor exigir a substituição das partes viciadas.\n" +
      "§ 1º Não sendo o vício sanado no prazo máximo de trinta dias, pode o consumidor exigir, alternativamente e à sua escolha:\n" +
      "I - a substituição do produto por outro da mesma espécie, em perfeitas condições de uso;\n" +
      "II - a restituição imediata da quantia paga, monetariamente atualizada, sem prejuízo de eventuais perdas e danos;\n" +
      "III - o abatimento proporcional do preço.",
  },
  {
    heading: "Art. 26",
    text:
      "O direito de reclamar pelos vícios aparentes ou de fácil constatação caduca em:\n" +
      "I - trinta dias, tratando-se de fornecimento de serviço e de produto não duráveis;\n" +
      "II - noventa dias, tratando-se de fornecimento de serviço e de produto duráveis.\n" +
      "§ 3º Tratando-se de vício oculto, o prazo decadencial inicia-se no momento em que ficar evidenciado o defeito.",
  },
  {
    heading: "Art. 35",
    text:
      "Se o fornecedor de produtos ou serviços recusar cumprimento à oferta, apresentação ou publicidade, o consumidor poderá, alternativamente e à sua livre escolha:\n" +
      "I - exigir o cumprimento forçado da obrigação, nos termos da oferta, apresentação ou publicidade;\n" +
      "II - aceitar outro produto ou prestação de serviço equivalente;\n" +
      "III - rescindir o contrato, com direito à restituição de quantia eventualmente antecipada, monetariamente atualizada, e a perdas e danos.",
  },
];

// ---------------------------------------------------------------------------
// Lei Maria da Penha (Lei 11.340/2006) — medidas protetivas
// ---------------------------------------------------------------------------

const LMP_PARTS = [
  {
    heading: "Art. 22",
    text:
      "Constatada a prática de violência doméstica e familiar contra a mulher, nos termos desta Lei, o juiz poderá aplicar, de imediato, ao agressor, em conjunto ou separadamente, as seguintes medidas protetivas de urgência, entre outras:\n" +
      "I - suspensão da posse ou restrição do porte de armas, com comunicação ao órgão competente, nos termos da Lei nº 10.826, de 22 de dezembro de 2003;\n" +
      "II - afastamento do lar, domicílio ou local de convivência com a ofendida;\n" +
      "III - proibição de determinadas condutas, entre as quais:\n" +
      "  a) aproximação da ofendida, de seus familiares e das testemunhas, fixando o limite mínimo de distância entre estes e o agressor;\n" +
      "  b) contato com a ofendida, seus familiares e testemunhas por qualquer meio de comunicação;\n" +
      "  c) frequentação de determinados lugares a fim de preservar a integridade física e psicológica da ofendida;\n" +
      "IV - restrição ou suspensão de visitas aos dependentes menores, ouvida a equipe de atendimento multidisciplinar ou serviço similar;\n" +
      "V - prestação de alimentos provisionais ou provisórios.",
  },
];

// ---------------------------------------------------------------------------
// Estatuto da Advocacia (Lei 8.906/1994) — prerrogativas essenciais
// ---------------------------------------------------------------------------

const EAOAB_PARTS = [
  {
    heading: "Art. 7º",
    text:
      "São direitos do advogado:\n" +
      "I - exercer, com liberdade, a profissão em todo o território nacional;\n" +
      "II - a inviolabilidade de seu escritório ou local de trabalho, bem como de seus instrumentos de trabalho, de sua correspondência escrita, eletrônica, telefônica e telemática, desde que relativas ao exercício da advocacia;\n" +
      "III - comunicar-se com seus clientes, pessoal e reservadamente, mesmo sem procuração, quando estes se acharem presos, detidos ou recolhidos em estabelecimentos civis ou militares, ainda que considerados incomunicáveis;\n" +
      "IV - ter a presença de representante da OAB, quando preso em flagrante, por motivo ligado ao exercício da advocacia, para lavratura do auto respectivo, sob pena de nulidade e, nos demais casos, a comunicação expressa à seccional da OAB;\n" +
      "V - não ser recolhido preso, antes de sentença transitada em julgado, senão em sala de Estado Maior, com instalações e comodidades condignas, e, na sua falta, em prisão domiciliar;\n" +
      "VI - ingressar livremente:\n" +
      "  a) nas salas de sessões dos tribunais, mesmo além dos cancelos que separam a parte reservada aos magistrados;\n" +
      "  b) nas salas e dependências de audiências, secretarias, cartórios, ofícios de justiça, serviços notariais e de registro, e, no caso de delegacias e prisões, mesmo fora da hora de expediente e independentemente da presença de seus titulares;\n" +
      "VIII - dirigir-se diretamente aos magistrados nas salas e gabinetes de trabalho, independentemente de horário previamente marcado ou outra condição, observando-se a ordem de chegada;\n" +
      "X - usar da palavra, pela ordem, em qualquer juízo ou tribunal, mediante intervenção sumária, para esclarecer equívoco ou dúvida surgida em relação a fatos, documentos ou afirmações que influam no julgamento, bem como para replicar acusação ou censura que lhe forem feitas.",
  },
];

export const MINIMAL_LEGAL_NORMS: MinimalLegalNorm[] = [
  {
    urnInput: {
      authority: "federal",
      documentType: "constituicao",
      date: "1988-10-05",
      number: "1988",
    },
    kind: NormKind.CONSTITUTION,
    title: "Constituição da República Federativa do Brasil de 1988",
    identifier: "CF/1988",
    authorityName: "Assembleia Nacional Constituinte",
    publishedAt: "1988-10-05",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    body: buildBody(CF_PARTS),
  },
  {
    urnInput: {
      authority: "federal",
      documentType: "lei",
      date: "2015-03-16",
      number: "13105",
    },
    kind: NormKind.CODE,
    title: "Código de Processo Civil (Lei nº 13.105/2015)",
    identifier: "CPC/2015 — Lei nº 13.105/2015",
    authorityName: "Congresso Nacional",
    publishedAt: "2015-03-16",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
    body: buildBody(CPC_PARTS),
  },
  {
    urnInput: {
      authority: "federal",
      documentType: "lei",
      date: "2002-01-10",
      number: "10406",
    },
    kind: NormKind.CODE,
    title: "Código Civil (Lei nº 10.406/2002)",
    identifier: "CC/2002 — Lei nº 10.406/2002",
    authorityName: "Congresso Nacional",
    publishedAt: "2002-01-10",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    body: buildBody(CC_PARTS),
  },
  {
    urnInput: {
      authority: "federal",
      documentType: "lei",
      date: "1990-09-11",
      number: "8078",
    },
    kind: NormKind.CODE,
    title: "Código de Defesa do Consumidor (Lei nº 8.078/1990)",
    identifier: "CDC — Lei nº 8.078/1990",
    authorityName: "Congresso Nacional",
    publishedAt: "1990-09-11",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
    body: buildBody(CDC_PARTS),
  },
  {
    urnInput: {
      authority: "federal",
      documentType: "lei",
      date: "2006-08-07",
      number: "11340",
    },
    kind: NormKind.ORDINARY_LAW,
    title: "Lei Maria da Penha (Lei nº 11.340/2006)",
    identifier: "Lei nº 11.340/2006",
    authorityName: "Congresso Nacional",
    publishedAt: "2006-08-07",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm",
    body: buildBody(LMP_PARTS),
  },
  {
    urnInput: {
      authority: "federal",
      documentType: "lei",
      date: "1994-07-04",
      number: "8906",
    },
    kind: NormKind.ORDINARY_LAW,
    title: "Estatuto da Advocacia e da OAB (Lei nº 8.906/1994)",
    identifier: "EAOAB — Lei nº 8.906/1994",
    authorityName: "Congresso Nacional",
    publishedAt: "1994-07-04",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8906.htm",
    body: buildBody(EAOAB_PARTS),
  },
];
