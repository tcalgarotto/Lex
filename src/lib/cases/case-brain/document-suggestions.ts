/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { runIntake } from "@/lib/cases/intake";

export type DocumentClassification = {
  label: string;
  confidence: number;
};

export function classifyDocumentFromNameAndText(
  fileName: string,
  text: string,
): DocumentClassification {
  const sample = `${fileName}\n${text}`.slice(0, 8000).toLowerCase();
  const rules: Array<{ label: string; re: RegExp; confidence: number }> = [
    { label: "comprovante", re: /\b(comprovante|recibo|comprov)\b/i, confidence: 0.72 },
    { label: "certidão", re: /\b(certid[aã]o|certificado)\b/i, confidence: 0.75 },
    { label: "contrato", re: /\b(contrato|cl[aá]usula|contratante)\b/i, confidence: 0.7 },
    { label: "ofício", re: /\b(of[ií]cio|oficio)\b/i, confidence: 0.68 },
    { label: "petição", re: /\b(exordial|peti[cç][aã]o|requer)\b/i, confidence: 0.65 },
    { label: "laudo", re: /\b(laudo|per[ií]cia|m[eé]dico)\b/i, confidence: 0.7 },
  ];
  for (const r of rules) {
    if (r.re.test(sample)) return { label: r.label, confidence: r.confidence };
  }
  return { label: "outro", confidence: 0.4 };
}

export type DocumentSuggestPayload = {
  classification: DocumentClassification;
  suggestedFacts: string[];
  suggestedRisks: string[];
  suggestedParties: Array<{ role: string; name: string }>;
  suggestedRequests: string[];
};

/**
 * Gera sugestões determinísticas a partir do texto extraído (sem chamada a modelo).
 */
export function suggestFromDocumentText(fileName: string, text: string): DocumentSuggestPayload {
  const intake = runIntake(text.slice(0, 50_000));
  const classification = classifyDocumentFromNameAndText(fileName, text);
  const suggestedFacts = intake.facts.map((f) => f.text).slice(0, 12);
  const suggestedRequests = intake.requests.map((r) => r.text).slice(0, 8);
  const suggestedParties = intake.parties.map((p) => ({ role: p.role, name: p.name })).slice(0, 8);
  const suggestedRisks: string[] = [];
  if (text.length < 80) {
    suggestedRisks.push("Texto extraído muito curto — verificar legibilidade do arquivo.");
  }
  if (/\bileg[ií]v|\bil[ií]cito\b/i.test(text)) {
    suggestedRisks.push("Trecho sugere possível ilicitude — validar contexto fático.");
  }
  return {
    classification,
    suggestedFacts,
    suggestedRisks,
    suggestedParties,
    suggestedRequests,
  };
}
