import { createHash } from "node:crypto";

/**
 * F22 — Identificador estável do estado do Case Brain para particionar cache
 * e correlação de logs (sem expor conteúdo bruto).
 */
export function buildCaseBrainFingerprint(metadataJson: unknown, caseUpdatedAt: Date): string {
  const meta =
    metadataJson && typeof metadataJson === "object" && metadataJson !== null
      ? (metadataJson as Record<string, unknown>)
      : {};
  const brain = meta["brain"];
  const h = createHash("sha256");
  h.update(JSON.stringify({ brain, u: caseUpdatedAt.toISOString() }));
  return h.digest("hex").slice(0, 24);
}
