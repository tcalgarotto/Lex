import { normalizeJustosPhone } from "@/lib/justos/phone-normalize";

export function normalizeCrmPhoneE164(input: string | null | undefined): string | null {
  if (input == null || !String(input).trim()) return null;
  return normalizeJustosPhone(String(input).trim());
}
