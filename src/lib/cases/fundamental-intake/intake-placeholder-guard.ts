import type { FundamentalIntakeForm } from "./form-schema";

/** Valores que eram defaults antigos (texto no value) — nunca devem persistir como dado. */
const LEGACY_PLACEHOLDER_EXACT = new Set([
  "novo caso",
  "cidade do caso",
  "nome completo do cliente",
  "descreva o problema com as palavras do cliente. salve o caso quando quiser; a organização automática com lex ai é opcional.",
]);

function isPlaceholderString(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return LEGACY_PLACEHOLDER_EXACT.has(t.toLowerCase());
}

function clean(s: string | undefined): string {
  if (!s) return "";
  return isPlaceholderString(s) ? "" : s.trim();
}

/** Remove artefatos de placeholder antes de salvar ou após carregar rascunho antigo. */
export function normalizeIntakeFormPlaceholders(form: FundamentalIntakeForm): FundamentalIntakeForm {
  return {
    ...form,
    attend: {
      ...form.attend,
      suggestedTitle: clean(form.attend.suggestedTitle),
      city: clean(form.attend.city),
      probableLegalArea: clean(form.attend.probableLegalArea),
    },
    clientPerson: form.clientPerson
      ? {
          ...form.clientPerson,
          fullName: clean(form.clientPerson.fullName),
        }
      : form.clientPerson,
    clientCompany: form.clientCompany
      ? {
          ...form.clientCompany,
          legalName: clean(form.clientCompany.legalName),
        }
      : form.clientCompany,
    narrative: {
      ...form.narrative,
      whatHappened: clean(form.narrative.whatHappened),
    },
  };
}

export function intakeFormContainsLegacyPlaceholders(form: FundamentalIntakeForm): boolean {
  const normalized = normalizeIntakeFormPlaceholders(form);
  return JSON.stringify(form) !== JSON.stringify(normalized);
}
