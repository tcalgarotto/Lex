/** Fixture — P2 PII parcial em sink (warning only no gate). */
import { getLogger } from "@/lib/logger";

const log = getLogger("fixture.p2");

export function unsafeP2() {
  log.warn("lead contact", {
    workspaceId: "ws_fixture",
    email: "lead@example.invalid",
    cpf: "529.982.247-25",
  });
}
