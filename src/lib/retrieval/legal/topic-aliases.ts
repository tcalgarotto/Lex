/**
 * Dicionário de aliases temáticos jurídicos (F3).
 *
 * Mapeia uma "área" curta (como aparece em `brain.area` ou em buscas
 * livres) para termos canônicos legais que ajudam recall do retrieval.
 *
 * Usado em `rewriteLegalQuery` quando há contexto de caso disponível
 * (`caseContext.area`).
 */

export type TopicAlias = {
  match: RegExp;
  expansions: string[];
};

const ALIASES: TopicAlias[] = [
  {
    match: /\b(creche|educa[cç][aã]o\s+infantil|berç[aá]rio|pr[ée]-?escola)\b/i,
    expansions: [
      "educação infantil",
      "art. 208 IV",
      "matrícula obrigatória",
      "dever do Estado educação",
      "art. 205 educação",
      "art. 227 absoluta prioridade",
      "criança e adolescente educação",
    ],
  },
  {
    match: /\b(sa[uú]de|SUS|medicamento|tratamento\s+m[ée]dico)\b/i,
    expansions: [
      "art. 196 saúde direito de todos",
      "art. 197 ações de saúde",
      "art. 198 SUS",
      "fornecimento de medicamentos",
      "tratamento de saúde",
    ],
  },
  {
    match: /\b(consumidor|defesa\s+do\s+consumidor|cobran[cç]a\s+indevida)\b/i,
    expansions: [
      "Código de Defesa do Consumidor",
      "art. 5º XXXII consumidor",
      "art. 170 V consumidor",
      "relação de consumo",
    ],
  },
  {
    match: /\b(crian[cç]a|adolescente|menor|inf[aâ]ncia|ECA)\b/i,
    expansions: [
      "art. 227 prioridade absoluta",
      "art. 228 inimputabilidade",
      "ECA criança e adolescente",
      "Estatuto da Criança",
    ],
  },
  {
    match: /\b(idoso|terceira\s+idade|estatuto\s+do\s+idoso)\b/i,
    expansions: [
      "art. 230 idosos",
      "Estatuto do Idoso",
      "Lei 10741/2003",
      "amparo à pessoa idosa",
    ],
  },
  {
    match: /\b(servidor|funcion[áa]rio\s+p[úu]blico|carreira\s+p[úu]blica|administra[cç][aã]o\s+p[úu]blica)\b/i,
    expansions: [
      "art. 37 administração pública",
      "art. 39 servidor público",
      "regime jurídico",
      "Lei 8112/1990",
    ],
  },
  {
    match: /\b(habita[cç][aã]o|moradia|aluguel|despejo|posse)\b/i,
    expansions: [
      "art. 6º moradia direito social",
      "art. 23 IX habitação",
      "Lei 8245/1991 locação",
      "função social da propriedade",
    ],
  },
  {
    match: /\b(trabalho|emprego|trabalhista|CLT|salário|hora\s+extra|FGTS)\b/i,
    expansions: [
      "art. 7º direitos trabalhadores",
      "art. 8º liberdade sindical",
      "Consolidação das Leis do Trabalho",
      "FGTS Lei 8036/1990",
    ],
  },
  {
    match: /\b(igualdade|n[aã]o\s+discrimina[cç][aã]o|preconceito|racismo|LGBT)\b/i,
    expansions: [
      "art. 5º caput igualdade",
      "art. 3º IV bem de todos",
      "art. 7º XXX vedação discriminação",
      "Lei 7716/1989 racismo",
    ],
  },
  {
    match: /\b(mandado\s+de\s+seguran[cç]a|MS|liminar|tutela\s+de\s+urg[eê]ncia)\b/i,
    expansions: [
      "art. 5º LXIX mandado de segurança",
      "art. 5º LXX MS coletivo",
      "Lei 12016/2009",
      "art. 300 CPC tutela de urgência",
    ],
  },
];

/**
 * Devolve uma lista achatada de expansões aplicáveis ao texto/áreas.
 * Idempotente — sem duplicatas.
 */
export function expandTopicAliases(args: {
  text?: string;
  areas?: string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const probe = [args.text ?? "", ...(args.areas ?? [])].join(" ");
  for (const alias of ALIASES) {
    if (alias.match.test(probe)) {
      for (const exp of alias.expansions) {
        const k = exp.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(exp);
      }
    }
  }
  return out;
}
