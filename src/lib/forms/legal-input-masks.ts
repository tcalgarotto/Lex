/**
 * Máscaras de entrada para formulários jurídicos (somente UI).
 * O backend continua recebendo strings; validadores usam dígitos quando necessário.
 */

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** CNJ progressivo até 20 dígitos: 0000000-00.0000.0.00.0000 */
export function maskCnjInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 20);
  if (d.length <= 7) return d;
  let out = `${d.slice(0, 7)}-`;
  const a = d.slice(7);
  if (a.length <= 2) return out + a;
  out += `${a.slice(0, 2)}.`;
  const b = a.slice(2);
  if (b.length <= 4) return out + b;
  out += `${b.slice(0, 4)}.`;
  const c = b.slice(4);
  if (c.length <= 1) return out + c;
  out += `${c.slice(0, 1)}.`;
  const e = c.slice(1);
  if (e.length <= 2) return out + e;
  out += `${e.slice(0, 2)}.`;
  out += e.slice(2, 6);
  return out;
}

export function maskCpfInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCnpjInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** (00) 0000-0000 ou (00) 00000-0000 */
export function maskPhoneBrInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  if (d.length <= 2) return `(${ddd}`;
  const rest = d.slice(2);
  if (rest.length <= 8) {
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export function maskCepInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function maskDateBrInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

const MS_PER_DAY = 86400000;

/** Converte dd/mm/aaaa em yyyy-mm-dd ou "" se inválido / fora da faixa razoável. */
export function parseBrDateToIso(br: string): string {
  const d = digitsOnly(br);
  if (d.length !== 8) return "";
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return "";
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return "";
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return "";
  const today = new Date();
  const max = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
  if (dt.getTime() > max.getTime() + MS_PER_DAY) return "";
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function formatIsoToBrDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Valor em centavos a partir de string já mascarada "R$ 1.234,56" ou dígitos. */
export function parseCurrencyBrlDigits(raw: string): bigint {
  const s = raw.replace(/[^\d]/g, "");
  if (!s) return 0n;
  return BigInt(s);
}

/** Exibe R$ a partir de centavos (bigint ou number). */
export function formatCurrencyBrlFromCents(cents: bigint | number): string {
  const c = typeof cents === "bigint" ? cents : BigInt(Math.round(cents));
  const neg = c < 0n;
  const v = neg ? -c : c;
  const int = v / 100n;
  const frac = v % 100n;
  const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = `R$ ${intStr},${frac.toString().padStart(2, "0")}`;
  return neg ? `-${out}` : out;
}

/** Máscara enquanto digita: interpreta dígitos como centavos (últimos 2 = centavos). */
export function maskCurrencyBrlInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatCurrencyBrlFromCents(BigInt(digits));
}
