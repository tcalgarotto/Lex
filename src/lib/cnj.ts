/**
 * CNJ (Conselho Nacional de Justiça) process number helpers.
 *
 * Formato canônico (20 dígitos):
 *   NNNNNNN-DD.AAAA.J.TR.OOOO
 *
 * Onde:
 * - NNNNNNN: número sequencial
 * - DD: dígitos verificadores
 * - AAAA: ano
 * - J: órgão/ramo do Judiciário
 * - TR: tribunal
 * - OOOO: unidade de origem
 */

export function stripCnj(input: string): string {
  return input.replace(/\D/g, "");
}

export function formatCnj(input: string): string {
  const d = stripCnj(input);
  if (d.length !== 20) return input.trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export function isValidCnj(input: string): boolean {
  return stripCnj(input).length === 20;
}

