/** Normaliza telefone BR para E.164 (+55…). */
export function normalizeJustosPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

export function normalizeJustosPhoneList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string" && raw.trim()) {
      const one = normalizeJustosPhone(raw);
      return one ? [one] : [];
    }
    return [];
  }
  return raw.map(normalizeJustosPhone).filter((n): n is string => Boolean(n));
}
