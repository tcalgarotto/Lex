/**
 * Mascaramento de PII para exibição na UI (LGPD-friendly por padrão).
 *
 * Regra geral: nunca expor CPF/CNPJ/telefone/email completos sem opt-in
 * explícito do usuário (ex.: toggle "Mostrar dados completos").
 *
 * Estes helpers são puros (sem side-effects), seguros para usar em
 * Server Components e Client Components.
 */

const DIGITS_ONLY = /\D+/g;

function digitsOf(value: string): string {
  return value.replace(DIGITS_ONLY, "");
}

/**
 * CPF: `123.456.789-09` → `***.456.789-**`
 *      `12345678909`     → `***.456.789-**`
 *
 * Mantém os 6 dígitos centrais (suficientes para conferência humana)
 * e mascara os 3 primeiros + 2 verificadores.
 */
export function maskCpf(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = digitsOf(value);
  if (digits.length !== 11) {
    // Não parece CPF válido — devolve mascarado defensivo.
    return value.replace(/\d/g, "*");
  }
  const middle = digits.slice(3, 6);
  const last = digits.slice(6, 9);
  return `***.${middle}.${last}-**`;
}

/**
 * CNPJ: `12.345.678/0001-99` → `**.345.678/0001-**`
 *       `12345678000199`     → `**.345.678/0001-**`
 *
 * Mantém raiz + filial; mascara prefixo e verificadores.
 */
export function maskCnpj(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = digitsOf(value);
  if (digits.length !== 14) {
    return value.replace(/\d/g, "*");
  }
  const root = digits.slice(2, 5);
  const tail = digits.slice(5, 8);
  const branch = digits.slice(8, 12);
  return `**.${root}.${tail}/${branch}-**`;
}

/**
 * Detecta automaticamente entre CPF e CNPJ pelo número de dígitos
 * e aplica a máscara correta.
 */
export function maskDocument(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = digitsOf(value);
  if (digits.length === 11) return maskCpf(value);
  if (digits.length === 14) return maskCnpj(value);
  return value.replace(/\d/g, "*");
}

/**
 * Telefone:
 *  - `(47) 99876-5432` → `(47) ****-5432`
 *  - `4799876543`      → `(47) ****-6543`
 *  - `1132458787`      → `(11) ****-8787`
 *
 * Mantém DDD e os 4 últimos dígitos (suficiente para o cliente
 * confirmar). Aceita formatos com ou sem máscara.
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = digitsOf(value);
  if (digits.length < 10 || digits.length > 11) {
    return value.replace(/\d/g, "*");
  }
  const ddd = digits.slice(0, 2);
  const last = digits.slice(-4);
  return `(${ddd}) ****-${last}`;
}

/**
 * Email: `ana.paula@gmail.com` → `a***a@gmail.com`.
 * Preserva primeiro/último char do localpart e o domínio inteiro.
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "—";
  const [local, domain] = value.split("@");
  if (!local || !domain) return value.replace(/[^@]/g, "*");
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  const first = local[0]!;
  const last = local[local.length - 1]!;
  return `${first}***${last}@${domain}`;
}

/**
 * Toggle entre máscara e valor pleno.
 * Use para alimentar UI controlada por estado `showFull` (ex.:
 * checkbox "Mostrar dados completos" no painel de partes).
 */
export function maybeMaskDocument(value: string | null | undefined, showFull: boolean): string {
  if (!value) return "—";
  return showFull ? value : maskDocument(value);
}

export function maybeMaskPhone(value: string | null | undefined, showFull: boolean): string {
  if (!value) return "—";
  return showFull ? value : maskPhone(value);
}

export function maybeMaskEmail(value: string | null | undefined, showFull: boolean): string {
  if (!value) return "—";
  return showFull ? value : maskEmail(value);
}
