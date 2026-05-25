/**
 * Autenticação server-to-server n8n → JustOS (callbacks).
 * Header: `Authorization: Bearer <JUSTOS_N8N_SERVICE_TOKEN>` (fallback LEX_*).
 */

import { readJustosN8nServiceToken } from "./env";

export function readLexN8nServiceToken(): string | undefined {
  return readJustosN8nServiceToken();
}

export function isLexN8nServiceAuthorized(req: Request): boolean {
  const expected = readLexN8nServiceToken();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7).trim() === expected;
}
