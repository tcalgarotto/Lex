/**
 * Registry de checklists jurídicos guiados (F2.1).
 *
 * Cada `ChecklistTemplate` é um modelo fixo de entrevista guiada por tipo de caso.
 * Estrutura assistida (acordeão por seção) na UI, alimenta o Case Brain
 * via `metadataJson.brain.checklistResponses`.
 *
 * Auditoria: campo `version` permite migração futura de respostas
 * (ex.: novo template substitui antigo, mas respostas antigas seguem
 * persistidas com a versão original).
 */

import { CRECHE_CHECKLIST } from "./templates/creche";
import { GENERIC_OFFLINE_CHECKLIST } from "./templates/generic-offline";
import { CONSUMER_INSURANCE_CHECKLIST } from "./templates/consumer-insurance";
import { BANK_CHARGEBACK_CHECKLIST } from "./templates/bank-chargeback";
import { LABOR_TERMINATION_CHECKLIST } from "./templates/labor-termination";
import { FAMILY_CHILD_SUPPORT_CHECKLIST } from "./templates/family-child-support";
import { FAMILY_DIVORCE_CHECKLIST } from "./templates/family-divorce";
import { REAL_ESTATE_RENT_CHECKLIST } from "./templates/real-estate-rent";
import { CIVIL_MEDICAL_MALPRACTICE_CHECKLIST } from "./templates/civil-medical-malpractice";
import { ADMIN_PUBLIC_TENDER_CHECKLIST } from "./templates/admin-public-tender";
import { CRIMINAL_BAIL_CHECKLIST } from "./templates/criminal-bail";

export type ChecklistFieldKind =
  | "text"
  | "long_text"
  | "date"
  | "number"
  | "phone"
  | "cpf"
  | "single_choice"
  | "multi_choice"
  | "boolean"
  | "file_ref";

export type ChecklistFieldOption = {
  id: string;
  label: string;
};

export type ChecklistField = {
  id: string;
  label: string;
  kind: ChecklistFieldKind;
  required: boolean;
  options?: ChecklistFieldOption[];
  helpText?: string;
  /** Caminho lógico no CaseBrain (ex.: "parties[role=child_or_dependent].age"). */
  brainPath?: string;
  /** Quando true, o campo conta como "blocker" da prontidão (F2.2). */
  blocker?: boolean;
};

export type ChecklistSection = {
  id: string;
  title: string;
  description?: string;
  fields: ChecklistField[];
};

export type ChecklistTemplate = {
  id: string;
  label: string;
  version: number;
  area: string[];
  /** Disparadores para sugestão automática a partir do brain. */
  triggers: {
    keywords: string[];
    brainHints: string[];
  };
  sections: ChecklistSection[];
};

const TEMPLATES: ChecklistTemplate[] = [
  // Genérico offline — sempre disponível como fallback.
  GENERIC_OFFLINE_CHECKLIST,
  // Templates por domínio (mínimo 10)
  CRECHE_CHECKLIST,
  CONSUMER_INSURANCE_CHECKLIST,
  BANK_CHARGEBACK_CHECKLIST,
  LABOR_TERMINATION_CHECKLIST,
  FAMILY_CHILD_SUPPORT_CHECKLIST,
  FAMILY_DIVORCE_CHECKLIST,
  REAL_ESTATE_RENT_CHECKLIST,
  CIVIL_MEDICAL_MALPRACTICE_CHECKLIST,
  ADMIN_PUBLIC_TENDER_CHECKLIST,
  CRIMINAL_BAIL_CHECKLIST,
];

const TEMPLATES_BY_ID: Map<string, ChecklistTemplate> = new Map(
  TEMPLATES.map((t) => [t.id, t]),
);

export function listChecklistTemplates(): ChecklistTemplate[] {
  return TEMPLATES;
}

export function getChecklistTemplate(id: string): ChecklistTemplate | null {
  return TEMPLATES_BY_ID.get(id) ?? null;
}

/**
 * Sugere um template baseado em texto livre + áreas detectadas.
 * Retorna o de maior score; ties são quebrados pela ordem de cadastro.
 */
export function suggestChecklistTemplate(args: {
  rawText?: string;
  brainAreas?: string[];
}): ChecklistTemplate | null {
  const text = (args.rawText ?? "").toLowerCase();
  const areas = (args.brainAreas ?? []).map((a) => a.toLowerCase());

  let best: { template: ChecklistTemplate; score: number } | null = null;

  for (const t of TEMPLATES) {
    let score = 0;
    for (const kw of t.triggers.keywords) {
      if (text.includes(kw.toLowerCase())) score += 2;
    }
    for (const hint of t.triggers.brainHints) {
      if (areas.some((a) => a.includes(hint.toLowerCase()))) score += 3;
    }
    for (const area of t.area) {
      if (areas.some((a) => a.includes(area.toLowerCase()))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { template: t, score };
    }
  }

  return best?.template ?? null;
}

/**
 * Lista de todos os campos `required` ainda não preenchidos pelas
 * respostas atuais. Útil para `nextBestAction` e UI de progresso.
 */
export function computeMissingFields(
  template: ChecklistTemplate,
  answers: Record<string, unknown>,
): ChecklistField[] {
  const out: ChecklistField[] = [];
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      if (!isFieldAnswered(field, answers[field.id])) out.push(field);
    }
  }
  return out;
}

export function isFieldAnswered(field: ChecklistField, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}
