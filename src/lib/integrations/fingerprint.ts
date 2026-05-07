/**
 * Fingerprint determinístico para idempotência de eventos/alertas.
 *
 * Não usa crypto.subtle (compatível com runtime Node sync).
 * Hash é estável + curto; suficiente p/ uniqueness em escala de workspace.
 */

import { createHash } from "node:crypto";

/**
 * Gera fingerprint hex curta (16 chars) a partir de partes ordenadas.
 * Strings vazias/nullish são normalizadas p/ "".
 */
export function fingerprintOf(parts: ReadonlyArray<unknown>): string {
  const normalized = parts.map((p) => {
    if (p === null || p === undefined) return "";
    if (typeof p === "string") return p.trim().toLowerCase();
    if (typeof p === "number" || typeof p === "boolean") return String(p);
    try {
      return JSON.stringify(p);
    } catch {
      return String(p);
    }
  });
  const h = createHash("sha256");
  h.update(normalized.join("\u0001"));
  return h.digest("hex").slice(0, 16);
}
