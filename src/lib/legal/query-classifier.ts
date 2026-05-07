export type LegalQueryType =
  | "document_summary"
  | "procedural_deadline"
  | "legal_basis"
  | "case_strategy"
  | "petition_generation"
  | "generic_question";

export type QueryClassification = {
  queryType: LegalQueryType;
  requiresStrongSources: boolean;
  requiresProcessDocument: boolean;
  signals: string[];
};

function hasAny(q: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q));
}

/** Determinístico: heurísticas simples e testáveis (sem IA). */
export function classifyLegalQuery(raw: string): QueryClassification {
  const q = raw.normalize("NFKC").toLowerCase();
  const signals: string[] = [];

  const isPetition = hasAny(q, [
    /\b(minuta|peti(ç|c)ão|manifest(a|ação)|contesta(ç|c)ão|réplica|agravo|apela(ç|c)ão|embargos|parecer|contrato)\b/i,
    /\bger(ar|e)\s+(uma\s+)?(pe(ç|c)a|peti(ç|c)ão|minuta)\b/i,
  ]);
  if (isPetition) signals.push("petition_generation");

  const isSummary = hasAny(q, [
    /\b(resuma|resumo|sintetize|síntese|explique|o que diz|o que consta|o que foi decidido)\b/i,
    /\b(despacho|decisão|senten(ç|c)a|acórd(ã|a)o)\b/i,
  ]);
  if (isSummary) signals.push("document_summary");

  const hasContextRef = hasAny(q, [
    /\b(esse|essa|este|esta)\s+(despacho|decis(ã|a)o|documento)\b/i,
    /\b(o juiz determinou|foi determinado|consta no despacho|consta na decisão)\b/i,
    /\b(responda isso|manifeste sobre|manifestar sobre)\b/i,
  ]);
  if (hasContextRef) signals.push("context_reference");

  const isDeadline = hasAny(q, [
    /\b(prazo|pra(?:z|s)os)\b/i,
    /\b(dias\s+(úteis|corridos)|contagem|tempestividade)\b/i,
    /\b(intima(ç|c)ão|publica(ç|c)ão)\b/i,
  ]);
  if (isDeadline) signals.push("procedural_deadline");

  const isJurisprudence = hasAny(q, [/\bjurisprud(ê|e)ncia\b/i, /\bprecedente(s)?\b/i, /\bac(ó|o)rd(ã|a)o\b/i]);
  const isLegalBasis = hasAny(q, [
    /\b(art\.?|artigo)\s*\d+/i,
    /\b(fundamento\s+legal|base\s+legal|fundamenta(ç|c)ão)\b/i,
    /\b(cpc|cc|clt|cdc|cpp|lei\s+\d+)/i,
    /\bs(ú|u)mula\b/i,
  ]);
  if (isJurisprudence) signals.push("jurisprudence");
  if (isLegalBasis) signals.push("legal_basis");

  const isStrategy = hasAny(q, [
    /\b(o que devo fazer|o que fazer|pr(o|ó)xima\s+(a(ç|c)(ã|a)o|medida)|provid(ê|e)ncia|como proceder)\b/i,
    /\b(recurso\s+cab(í|i)vel|caberia\s+qual\s+recurso)\b/i,
    /\b(consequ(ê|e)ncia\s+jur(í|i)dica|risco)\b/i,
  ]);
  if (isStrategy) signals.push("case_strategy");

  let queryType: LegalQueryType = "generic_question";
  if (isPetition) queryType = "petition_generation";
  else if (isDeadline) queryType = "procedural_deadline";
  else if (isLegalBasis || isJurisprudence) queryType = "legal_basis";
  else if (
    isStrategy ||
    (hasContextRef &&
      hasAny(q, [/\b(o que devo fazer|qual provid(ê|e)ncia|como proceder|pr(o|ó)xima\s+medida)\b/i]))
  ) {
    // Priorizar estratégia quando o usuário pede providência/ação, mesmo citando despacho/decisão.
    queryType = "case_strategy";
  } else if (isSummary) queryType = "document_summary";

  const requiresStrongSources =
    queryType === "procedural_deadline" ||
    queryType === "legal_basis" ||
    queryType === "petition_generation" ||
    isJurisprudence ||
    hasAny(q, [
      /\b(s(ú|u)mula|precedente|tese\s+pacificada|entendimento\s+consolidado)\b/i,
      /\b(prazo|art\.?|artigo|recurso\s+cab(í|i)vel)\b/i,
    ]);

  if (requiresStrongSources) signals.push("requiresStrongSources");

  const requiresProcessDocument =
    hasContextRef ||
    queryType === "document_summary" ||
    (queryType === "case_strategy" && hasAny(q, [/\b(despacho|decis(ã|a)o)\b/i])) ||
    hasAny(q, [/\b(este documento|esse documento|essa decisão|esse despacho)\b/i]);

  if (requiresProcessDocument) signals.push("requiresProcessDocument");

  return { queryType, requiresStrongSources, requiresProcessDocument, signals };
}

