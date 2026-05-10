/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Placeholder para evento `lex/case.ready-for-research`.
 * Lane E: registrar esta função em `src/app/api/inngest/route.ts` se o produto
 * precisar de um gatilho dedicado além de `lex/case.brain`.
 * Ver: docs/CASE_BRAIN.md
 */

import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.inngest.case-ready-for-research");

export const caseReadyForResearchPlaceholder = inngest.createFunction(
  { id: "case-ready-for-research-placeholder", retries: 0 },
  { event: "lex/case.ready-for-research" },
  async ({ event }) => {
    log.info("ready-for-research event received (no-op until Lane E registers workflow)", {
      caseId: event.data.caseId,
    });
    return { ok: true, noop: true };
  },
);
