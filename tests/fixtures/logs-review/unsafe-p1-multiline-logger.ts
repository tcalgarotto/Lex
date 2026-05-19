/** Fixture — P1 em janela multilinha após logger. */
import { getLogger } from "@/lib/logger";

const log = getLogger("fixture.multiline");

export function unsafeMultiline() {
  log.error("ingest failed", {
    workspaceId: "ws_x",
    documentText: "texto juridico completo do cliente",
    fullText: "mais texto",
  });
}
