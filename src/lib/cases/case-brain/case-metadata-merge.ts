/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

/**
 * Garante que atualizações parciais de `metadataJson` não apaguem `caseBrain`
 * (fundamentos pinados, política de indexação, etc.).
 */
export function mergeCaseMetadataJson(
  previous: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    previous && typeof previous === "object" && previous !== null
      ? { ...previous }
      : {};
  const prevBrain = base["caseBrain"];
  const next = { ...base, ...patch };
  const patchBrain = patch["caseBrain"];
  if (prevBrain && typeof prevBrain === "object" && patchBrain && typeof patchBrain === "object") {
    next["caseBrain"] = { ...(prevBrain as Record<string, unknown>), ...(patchBrain as Record<string, unknown>) };
  } else if (prevBrain && typeof prevBrain === "object" && !("caseBrain" in patch)) {
    next["caseBrain"] = prevBrain;
  }
  return next;
}
