import { digitsOnly, parseBrDateToIso } from "@/lib/forms/legal-input-masks";

export type BrDateValidationMode = "general" | "birth" | "event" | "appointment";

export type BrDateValidationResult =
  | { ok: true; iso: string }
  | { ok: false; message: string };

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Valida dd/mm/aaaa (completo) e retorna ISO yyyy-mm-dd ou erro amigável. */
export function validateBrDateString(
  br: string,
  mode: BrDateValidationMode = "general",
): BrDateValidationResult {
  const trimmed = br.trim();
  if (!trimmed) return { ok: true, iso: "" };

  const d = digitsOnly(trimmed);
  if (d.length !== 8) {
    return { ok: false, message: "Informe a data completa no formato dd/mm/aaaa." };
  }

  const iso = parseBrDateToIso(trimmed);
  if (!iso) {
    return { ok: false, message: "Data inválida. Verifique dia, mês e ano." };
  }

  const [y, m, day] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, day!));
  const today = startOfTodayUtc();

  if (mode === "birth" && dt.getTime() > today.getTime()) {
    return { ok: false, message: "Data de nascimento não pode ser no futuro." };
  }

  if (mode === "event" && dt.getTime() > today.getTime() + 86400000) {
    return {
      ok: false,
      message: "Para fatos já ocorridos, use data passada ou marque “data aproximada”.",
    };
  }

  if (mode === "appointment" && dt.getTime() < today.getTime() - 86400000 * 365 * 30) {
    return { ok: false, message: "Prazo ou audiência muito distante no passado — confira a data." };
  }

  if (mode === "general" && y! < 1900) {
    return { ok: false, message: "Ano inválido." };
  }

  return { ok: true, iso };
}

export function validateIsoDateString(
  iso: string,
  mode: BrDateValidationMode = "general",
): BrDateValidationResult {
  if (!iso.trim()) return { ok: true, iso: "" };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return { ok: false, message: "Data interna inválida." };
  const br = `${m[3]}/${m[2]}/${m[1]}`;
  return validateBrDateString(br, mode);
}
