/**
 * Título do caso para UI: linha principal (partes) vs subtítulo após separador comum.
 */

const TITLE_SEPARATORS = [" — ", " – ", " —", "– ", " - "] as const;

export function splitCaseTitle(title: string): { primary: string; secondary: string | null } {
  const trimmed = title.trim();
  for (const sep of TITLE_SEPARATORS) {
    const i = trimmed.indexOf(sep);
    if (i > 0 && i + sep.length < trimmed.length) {
      const a = trimmed.slice(0, i).trim();
      const b = trimmed.slice(i + sep.length).trim();
      if (a && b) return { primary: a, secondary: b };
    }
  }
  return { primary: trimmed, secondary: null };
}

/** Header / breadcrumb: só “Autora X Ré”, sem o texto após o separador. */
export function getCasePrimaryTitle(title: string): string {
  return splitCaseTitle(title).primary;
}
