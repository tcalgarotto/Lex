/**
 * F20 — Leitura normalizada de metadados de auditoria em entidades do caso.
 * O schema Prisma mantém colunas estáveis; detalhes de origem ficam em `metadataJson`.
 */

export type CaseEntityOriginMeta = {
  sourceText?: string;
  origin?: string;
  source?: string;
  status?: string;
  confidence?: number;
  lastEditedAt?: string;
  lastEditedById?: string;
};

export function parseMetadataJson(raw: unknown): CaseEntityOriginMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  const num = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : undefined);
  return {
    sourceText: str("sourceText"),
    origin: str("origin"),
    source: str("source"),
    status: str("status"),
    confidence: num("confidence"),
    lastEditedAt: str("lastEditedAt"),
    lastEditedById: str("lastEditedById"),
  };
}
