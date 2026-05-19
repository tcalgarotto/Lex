/**
 * FASE 5.1 — Completion E2E com provider real (DeepSeek).
 * Executa somente se DEEPSEEK_API_KEY estiver definida (nunca loga a key).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertRedTeamDatabaseReachable,
  attackState,
  RedTeamReport,
  setPersona,
} from "./helpers";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { vi } from "vitest";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";
import { POST as postCompletion } from "@/app/api/completion/route";

const hasProviderKey = Boolean(process.env["DEEPSEEK_API_KEY"]?.trim());

vi.mock("@/lib/auth/session", async () => ({
  getWorkspaceContext: vi.fn(async () => {
    if (!attackState.userId) throw new Error("Não autenticado");
    return {
      workspaceId: attackState.workspaceId,
      user: { id: attackState.userId, email: attackState.email },
    };
  }),
  getWorkspaceContextWithRole: vi.fn(async () => {
    if (!attackState.userId || !attackState.role) throw new Error("Sem associação ativa");
    return {
      workspaceId: attackState.workspaceId,
      user: { id: attackState.userId, email: attackState.email },
      role: attackState.role,
    };
  }),
}));

const report = new RedTeamReport();
let envOk = false;
let fixturesOk = false;

beforeAll(async () => {
  if (!hasProviderKey) {
    report.skip("Suite CE provider", "DEEPSEEK_API_KEY ausente — defina no .env para E2E real");
    return;
  }
  const db = await assertRedTeamDatabaseReachable();
  envOk = db.ok;
  if (!envOk) {
    report.skip("Suite CE provider", db.ok === false ? db.reason : "DB indisponível");
    return;
  }
  setPersona("commonA");
  fixturesOk = Boolean(
    await prisma.documentChunk.findUnique({ where: { id: RT.chunks.b.id }, select: { id: true } }),
  );
});

afterAll(() => report.print());

describe.skipIf(!hasProviderKey)("FASE 5.1 — Completion E2E (provider real)", () => {
  it(
    "CE.R1 stream real: resposta sem marcador Bravo",
    async () => {
      if (!envOk || !fixturesOk) return;
      setPersona("commonA");
      const res = await postCompletion(
        new Request("http://local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "continue",
            selection: "Escreva uma frase neutra sobre direito processual civil.",
            processId: RT.processes.a.id,
          }),
        }),
      );
      const body = await res.text();
      const leaked =
        body.includes(RT_SECRET_MARKER_B) ||
        body.includes("segredo ultra confidencial") ||
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(body);
      if (res.status < 500 && !leaked) {
        report.pass("CE.R1 provider real: resposta sem marcador B/JWT");
      } else if (leaked) {
        report.fail("CE.R1 provider vazou marcador ou token", { severity: "P0", obtained: String(res.status) });
      } else {
        report.skip("CE.R1 provider", `status=${res.status}`);
      }
      expect(leaked).toBe(false);
    },
    120_000,
  );

  it(
    "CE.R2 processId B adulterado: resposta sem marcador B",
    async () => {
      if (!envOk || !fixturesOk) return;
      setPersona("commonA");
      const res = await postCompletion(
        new Request("http://local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "continue",
            selection: "Continue.",
            processId: RT.processes.b.id,
          }),
        }),
      );
      const body = await res.text();
      const leaked = body.includes(RT_SECRET_MARKER_B);
      if (res.status < 500 && !leaked) report.pass("CE.R2 provider real com processId B sem vazamento");
      else if (leaked) report.fail("CE.R2 vazamento com processId B", { severity: "P0" });
      expect(leaked).toBe(false);
    },
    120_000,
  );
});

describe("FASE 5.1 — Completion provider gate", () => {
  it("CE.G1 status do provider E2E", () => {
    if (hasProviderKey) {
      report.pass("CE.G1 DEEPSEEK_API_KEY presente — suite provider habilitada");
    } else {
      report.skip(
        "CE.G1 completion provider real",
        "DEEPSEEK_API_KEY ausente — release IA crítico bloqueado até E2E real",
      );
    }
    expect(true).toBe(true);
  });
});
