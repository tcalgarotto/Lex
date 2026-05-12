import { after } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { ensurePdfThumbnailInStorage } from "@/lib/documents/document-thumbnail-persist";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.document.thumbnail-schedule");

/** Evita rajadas de `inngest.send` idênticas no mesmo processo. */
const recentInngestThumb = new Map<string, number>();
const INNGEST_COOLDOWN_MS = 90_000;

/** Evita empilhar dezenas de `after(ensure…)` quando a UI faz poll ao placeholder. */
const recentAfterThumb = new Map<string, number>();
const AFTER_THUMB_COOLDOWN_MS = 45_000;

export type ScheduleThumbnailOptions = {
  /** Upload/reprocess: dispara `after()` sempre. GET ao placeholder: limita frequência. */
  eagerBackground?: boolean;
};

/**
 * Enfileira geração de miniatura (Inngest + `after` local).
 * Não bloqueia a resposta HTTP — usar após upload, reprocess ou GET placeholder.
 */
export function scheduleDocumentThumbnailWork(
  documentId: string,
  options: ScheduleThumbnailOptions = {},
): void {
  const now = Date.now();
  const last = recentInngestThumb.get(documentId) ?? 0;
  if (now - last > INNGEST_COOLDOWN_MS) {
    recentInngestThumb.set(documentId, now);
    void inngest
      .send({
        id: `thumb-gen-${documentId}`,
        name: "lex/document.thumbnail",
        data: { documentId },
      })
      .catch((e) => {
        log.warn("inngest thumbnail send failed (non-fatal)", {
          documentId,
          err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
        });
      });
  }

  const eager = options.eagerBackground === true;
  if (!eager) {
    const lastAfter = recentAfterThumb.get(documentId) ?? 0;
    if (now - lastAfter < AFTER_THUMB_COOLDOWN_MS) {
      return;
    }
    recentAfterThumb.set(documentId, now);
  }

  after(() => {
    void ensurePdfThumbnailInStorage(documentId).catch((e) => {
      log.warn("after() thumbnail generation failed (non-fatal)", {
        documentId,
        err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
      });
    });
  });
}
