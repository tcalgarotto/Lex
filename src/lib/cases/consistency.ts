/**
 * F4.5 — Document × Case consistency checker.
 *
 * Compara dados estruturados do Brain (BrainParty.name/document/age,
 * fatos com datas, problema/cidade) com o texto extraído de documentos
 * vinculados ao caso. Quando algo bate "quase" mas não bate, gera
 * `CaseInconsistency` com severidade.
 *
 * Heurísticas usadas:
 *  - Levenshtein normalizada para nomes próprios (limiar 0.7..0.92).
 *  - Match de CPF (11 dígitos), CNPJ (14 dígitos), processo CNJ (20 dígitos).
 *  - Datas em formatos pt-BR (DD/MM/AAAA) e ISO (AAAA-MM-DD).
 *  - Idade em anos (1..120).
 *
 * O resultado é consumido por:
 *  - `consolidateCaseBrain` → preenche `brain.inconsistencies`
 *  - `checkDocumentConsistencyFn` (Inngest) → cria `CaseRisk`
 *    DOCUMENT_INCONSISTENCY + Timeline event + UI alert.
 *
 * Não usamos LLM aqui — comparações puramente determinísticas para
 * auditoria e custo zero.
 */

import type { CaseBrain, BrainParty } from "./brain-types";

export type CaseInconsistency = {
  /** Categoria curta — usada como "kind" tanto no Brain quanto no CaseRisk. */
  kind: ConsistencyKind;
  /** Descrição em PT-BR para o advogado entender o problema. */
  description: string;
  /** Severidade derivada da diferença. */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Trecho do documento que motivou a flag. */
  evidence: string;
  /** Documento de origem (id) — para link na UI. */
  documentId: string;
  /** Nome amigável do documento (para tooltip/log). */
  documentName: string;
  /** Sugestão de ação corretiva. */
  suggestion: string;
};

export type ConsistencyKind =
  | "name_mismatch"
  | "name_typo"
  | "cpf_mismatch"
  | "cnpj_mismatch"
  | "process_number_mismatch"
  | "age_mismatch"
  | "date_mismatch"
  | "city_mismatch";

export type CheckArgs = {
  brain: CaseBrain;
  documents: Array<{ id: string; originalName: string; text: string }>;
  /** Cidade declarada no caso (Case.uf/city ou inferida do brain). */
  caseCity?: string | null;
  /** Número CNJ informado no caso (se pré-processual = null). */
  caseProcessNumber?: string | null;
};

/* ============================== entry =================================== */

export function checkDocumentConsistency(args: CheckArgs): CaseInconsistency[] {
  const out: CaseInconsistency[] = [];
  if (!args.documents.length) return out;

  for (const doc of args.documents) {
    if (!doc.text || doc.text.trim().length < 20) continue;
    const text = doc.text;
    const docMeta = { documentId: doc.id, documentName: doc.originalName };

    // --- Nomes das partes
    for (const p of args.brain.parties ?? []) {
      const findings = compareNames(p, text);
      for (const f of findings) {
        out.push({ ...f, ...docMeta });
      }
    }

    // --- CPF/CNPJ das partes
    for (const p of args.brain.parties ?? []) {
      const f = compareDocumentNumber(p, text);
      if (f) out.push({ ...f, ...docMeta });
    }

    // --- Idade / data de nascimento
    for (const p of args.brain.parties ?? []) {
      const f = compareAge(p, text);
      if (f) out.push({ ...f, ...docMeta });
    }

    // --- Datas dos fatos
    for (const fact of args.brain.facts ?? []) {
      if (!fact.date) continue;
      const f = compareFactDate(fact.text, fact.date, text);
      if (f) out.push({ ...f, ...docMeta });
    }

    // --- Cidade
    if (args.caseCity) {
      const f = compareCity(args.caseCity, text);
      if (f) out.push({ ...f, ...docMeta });
    }

    // --- Número do processo (CNJ)
    if (args.caseProcessNumber) {
      const f = compareProcessNumber(args.caseProcessNumber, text);
      if (f) out.push({ ...f, ...docMeta });
    }
  }

  return dedupe(out);
}

/* ============================== checks =================================== */

function compareNames(p: BrainParty, text: string): Omit<CaseInconsistency, "documentId" | "documentName">[] {
  const out: Omit<CaseInconsistency, "documentId" | "documentName">[] = [];
  const expected = normalizeName(p.name);
  if (expected.length < 3) return out;

  const candidates = extractCapitalizedSequences(text);
  let bestSim = 0;
  let bestMatch = "";
  for (const cand of candidates) {
    const sim = nameSimilarity(expected, normalizeName(cand));
    if (sim > bestSim) {
      bestSim = sim;
      bestMatch = cand;
    }
  }

  if (bestMatch.length === 0) return out;
  if (bestSim >= 0.96) return out; // match perfeito (ignora caps/acentos)
  if (bestSim >= 0.78) {
    // typo — provável match com pequena divergência
    out.push({
      kind: "name_typo",
      severity: "MEDIUM",
      description: `Nome "${p.name}" aparece como "${bestMatch}" no documento (similaridade ${(bestSim * 100).toFixed(0)}%).`,
      evidence: extractContext(text, bestMatch),
      suggestion: `Confirmar grafia oficial — pode ser apenas variação ortográfica.`,
    });
  }
  // Sim < 0.78: sequer há candidato razoável; não criamos inconsistência
  // pra evitar ruído (documento pode não conter o nome).
  return out;
}

function compareDocumentNumber(
  p: BrainParty,
  text: string,
): Omit<CaseInconsistency, "documentId" | "documentName"> | null {
  const decl = p.document?.replace(/\D/g, "");
  if (!decl || decl.length < 11) return null;

  if (decl.length === 11) {
    const cpfs = extractCpfs(text);
    if (cpfs.length === 0) return null;
    if (cpfs.includes(decl)) return null;
    const docHint = cpfs[0] ?? "";
    return {
      kind: "cpf_mismatch",
      severity: "HIGH",
      description: `CPF declarado para ${p.name} (${formatCpf(decl)}) não corresponde aos CPFs encontrados no documento (ex.: ${formatCpf(docHint)}).`,
      evidence: extractContext(text, docHint),
      suggestion: `Verificar qual CPF está correto antes de usar na qualificação.`,
    };
  }
  if (decl.length === 14) {
    const cnpjs = extractCnpjs(text);
    if (cnpjs.length === 0) return null;
    if (cnpjs.includes(decl)) return null;
    const docHint = cnpjs[0] ?? "";
    return {
      kind: "cnpj_mismatch",
      severity: "HIGH",
      description: `CNPJ declarado para ${p.name} (${formatCnpj(decl)}) não corresponde aos CNPJs encontrados no documento.`,
      evidence: extractContext(text, docHint),
      suggestion: `Confirmar a entidade certa.`,
    };
  }
  return null;
}

function compareAge(
  p: BrainParty,
  text: string,
): Omit<CaseInconsistency, "documentId" | "documentName"> | null {
  if (p.age === undefined || p.age === null) return null;
  const expected = p.age;
  // procura padrões "X anos" perto do nome
  const window = extractContext(text, p.name, 200);
  const m = window.match(/(\d{1,3})\s*anos?\b/i);
  if (!m || !m[1]) return null;
  const found = parseInt(m[1], 10);
  if (!Number.isFinite(found) || found < 0 || found > 120) return null;
  if (Math.abs(found - expected) <= 1) return null;
  return {
    kind: "age_mismatch",
    severity: Math.abs(found - expected) > 3 ? "HIGH" : "MEDIUM",
    description: `Idade de ${p.name}: brain registra ${expected} ano(s), mas o documento menciona ${found} ano(s).`,
    evidence: window,
    suggestion: `Atualizar a idade no brain ou checar se o documento está desatualizado.`,
  };
}

function compareFactDate(
  factText: string,
  expectedIsoDate: string,
  text: string,
): Omit<CaseInconsistency, "documentId" | "documentName"> | null {
  const expected = parseIsoDate(expectedIsoDate);
  if (!expected) return null;
  const datesInDoc = extractDates(text);
  if (datesInDoc.length === 0) return null;
  // Se nenhuma data do doc bate com a esperada (±2 dias), e o fato menciona
  // pelo menos uma palavra-chave do doc, sinalizamos.
  const close = datesInDoc.find((d) => Math.abs(d.getTime() - expected.getTime()) <= 1000 * 60 * 60 * 48);
  if (close) return null;
  // Para reduzir falso positivo, só sinaliza se factText tem alguma palavra
  // (>= 4 chars) presente no documento.
  const factKws = factText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 5)
    .slice(0, 6);
  const docLower = text.toLowerCase();
  const overlap = factKws.some((w) => docLower.includes(w));
  if (!overlap) return null;
  const closest = datesInDoc[0]!;
  return {
    kind: "date_mismatch",
    severity: "MEDIUM",
    description: `Fato relacionado a "${factText.slice(0, 80)}" tem data ${formatBr(expected)} no brain, mas o documento referencia ${formatBr(closest)}.`,
    evidence: extractContext(text, formatBr(closest), 160),
    suggestion: `Confirmar a data correta antes de usar nos fatos da peça.`,
  };
}

function compareCity(
  expectedCity: string,
  text: string,
): Omit<CaseInconsistency, "documentId" | "documentName"> | null {
  const expected = normalizeName(expectedCity);
  if (expected.length < 3) return null;
  // procura cidades capitalizadas mencionadas
  const candidates = extractCapitalizedSequences(text).filter(
    (c) => c.length >= 3 && c.length <= 30,
  );
  if (candidates.length === 0) return null;
  let best = "";
  let bestSim = 0;
  for (const c of candidates) {
    const sim = nameSimilarity(expected, normalizeName(c));
    if (sim > bestSim) {
      bestSim = sim;
      best = c;
    }
  }
  if (bestSim >= 0.92) return null; // mesma cidade
  if (bestSim < 0.5) return null; // sem evidência clara
  return {
    kind: "city_mismatch",
    severity: "LOW",
    description: `Cidade do caso declarada como "${expectedCity}", mas o documento menciona "${best}" como possível município.`,
    evidence: extractContext(text, best),
    suggestion: `Verificar a comarca correta para o endereçamento da peça.`,
  };
}

function compareProcessNumber(
  expectedRaw: string,
  text: string,
): Omit<CaseInconsistency, "documentId" | "documentName"> | null {
  const expected = expectedRaw.replace(/\D/g, "");
  if (expected.length !== 20) return null;
  const candidates = extractProcessNumbers(text);
  if (candidates.length === 0) return null;
  if (candidates.includes(expected)) return null;
  const found = candidates[0]!;
  return {
    kind: "process_number_mismatch",
    severity: "CRITICAL",
    description: `Número de processo declarado (${formatCnj(expected)}) divergente do número encontrado no documento (${formatCnj(found)}).`,
    evidence: extractContext(text, found),
    suggestion: `Esse erro pode invalidar a peça — confirmar o número CNJ correto antes de qualquer protocolo.`,
  };
}

/* ============================== utils =================================== */

function dedupe(items: CaseInconsistency[]): CaseInconsistency[] {
  const seen = new Set<string>();
  const out: CaseInconsistency[] = [];
  for (const i of items) {
    const k = `${i.kind}|${i.documentId}|${i.description.slice(0, 80)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  return 1 - levenshtein(a, b) / len;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const v0 = new Array<number>(bl + 1).fill(0);
  const v1 = new Array<number>(bl + 1).fill(0);
  for (let i = 0; i <= bl; i++) v0[i] = i;
  for (let i = 0; i < al; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bl; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(
        v1[j]! + 1,
        v0[j + 1]! + 1,
        v0[j]! + cost,
      );
    }
    for (let j = 0; j <= bl; j++) v0[j] = v1[j]!;
  }
  return v0[bl]!;
}

const NAME_REGEX = /([A-ZÁÂÃÀÉÊÍÓÔÕÚÇ][a-záâãàéêíóôõúç]+(?:\s+(?:de|da|do|das|dos|e|von|van|del|la|el)\s+|\s+)?)+(?:[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ][a-záâãàéêíóôõúç]+)/g;

function extractCapitalizedSequences(text: string): string[] {
  const matches = text.match(NAME_REGEX) ?? [];
  return matches
    .map((m) => m.trim())
    .filter((m) => m.split(/\s+/).length >= 1 && m.length >= 3 && m.length < 80);
}

function extractCpfs(text: string): string[] {
  const re = /\b(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[\-\s]?(\d{2})\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[1]}${m[2]}${m[3]}${m[4]}`);
  }
  return Array.from(new Set(out));
}

function extractCnpjs(text: string): string[] {
  const re = /\b(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})[/\s]?(\d{4})[\-\s]?(\d{2})\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`);
  }
  return Array.from(new Set(out));
}

function extractProcessNumbers(text: string): string[] {
  const re = /\b\d{7}[-\s]?\d{2}\.?\s?\d{4}\.?\s?\d{1}\.?\s?\d{2}\.?\s?\d{4}\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].replace(/\D/g, ""));
  }
  return Array.from(new Set(out)).filter((s) => s.length === 20);
}

function extractDates(text: string): Date[] {
  const out: Date[] = [];
  const reBr = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reBr.exec(text)) !== null) {
    const d = parseInt(m[1]!, 10);
    const mo = parseInt(m[2]!, 10);
    const y = parseInt(m[3]!, 10);
    const yyyy = y < 100 ? 2000 + y : y;
    if (yyyy < 1900 || yyyy > 2100) continue;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    out.push(new Date(Date.UTC(yyyy, mo - 1, d)));
  }
  const reIso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = reIso.exec(text)) !== null) {
    const y = parseInt(m[1]!, 10);
    const mo = parseInt(m[2]!, 10);
    const d = parseInt(m[3]!, 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    out.push(new Date(Date.UTC(y, mo - 1, d)));
  }
  return out;
}

function parseIsoDate(s: string): Date | null {
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = parseInt(iso[1]!, 10);
    const m = parseInt(iso[2]!, 10);
    const d = parseInt(iso[3]!, 10);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (br) {
    const d = parseInt(br[1]!, 10);
    const m = parseInt(br[2]!, 10);
    const y = parseInt(br[3]!, 10);
    const yyyy = y < 100 ? 2000 + y : y;
    return new Date(Date.UTC(yyyy, m - 1, d));
  }
  return null;
}

function formatCpf(s: string): string {
  if (s.length !== 11) return s;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
}

function formatCnpj(s: string): string {
  if (s.length !== 14) return s;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
}

function formatCnj(s: string): string {
  if (s.length !== 20) return s;
  return `${s.slice(0, 7)}-${s.slice(7, 9)}.${s.slice(9, 13)}.${s.slice(13, 14)}.${s.slice(14, 16)}.${s.slice(16, 20)}`;
}

function formatBr(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

function extractContext(text: string, anchor: string, radius = 120): string {
  if (!anchor) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(anchor.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + anchor.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}
