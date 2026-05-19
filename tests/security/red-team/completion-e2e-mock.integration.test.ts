/**
 * FASE 5.1 — Completion E2E (mock adversarial; não chama provider real).
 * Complementa PI.B5.5 quando DEEPSEEK_API_KEY ausente.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertRedTeamDatabaseReachable,
  attackState,
  RedTeamReport,
  setPersona,
} from "./helpers";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";
import { POST as postCompletion } from "@/app/api/completion/route";

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
  requireAuthUser: vi.fn(async () => {
    if (!attackState.userId) throw new Error("Não autenticado");
    return { id: attackState.userId, email: attackState.email };
  }),
  requirePermission: vi.fn(async (permission: import("@/lib/auth/permissions").PermissionKey) => {
    if (!attackState.userId) throw new Error("Não autenticado");
    if (!attackState.role) throw new Error("Sem associação ativa neste workspace.");
    if (!can(attackState.role, permission)) {
      throw new Error(`Permissão insuficiente: ${permission}`);
    }
    return {
      user: { id: attackState.userId, email: attackState.email },
      role: attackState.role,
      workspaceId: attackState.workspaceId,
    };
  }),
}));

const providerCalled = vi.hoisted(() => ({ n: 0 }));
const streamCapture = vi.hoisted(() => ({
  system: "" as string,
  prompt: "" as string,
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn((opts: { system?: string; prompt?: string }) => {
      providerCalled.n += 1;
      streamCapture.system = opts.system ?? "";
      streamCapture.prompt = opts.prompt ?? "";
      return {
        toTextStreamResponse: () =>
          new Response("Resposta mock red-team sem segredo.", { status: 200 }),
      };
    }),
  };
});

vi.mock("@/lib/ai/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/llm")>();
  return {
    ...actual,
    expandQuery: vi.fn(async (q: string) => q),
    getChatLanguageModel: vi.fn(() => ({ modelId: "mock-adversarial" }) as never),
  };
});

const report = new RedTeamReport();
let envOk = false;
let fixturesOk = false;

beforeAll(async () => {
  const db = await assertRedTeamDatabaseReachable();
  envOk = db.ok;
  if (!envOk) {
    report.skip("Suite CE mock", db.ok === false ? db.reason : "DB indisponível");
    return;
  }
  setPersona("commonA");
  fixturesOk = Boolean(
    await prisma.documentChunk.findUnique({ where: { id: RT.chunks.b.id }, select: { id: true } }),
  );
  if (!fixturesOk) report.skip("Suite CE mock", "Rode npm run security:red-team:seed");
});

afterAll(() => report.print());

describe("FASE 5.1 — Completion E2E (mock)", () => {
  it("CE.M1 system sem marcador Bravo (RAG isolado)", async () => {
    if (!envOk || !fixturesOk) return;
    providerCalled.n = 0;
    streamCapture.system = "";
    setPersona("commonA");
    const res = await postCompletion(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "continue",
          selection: "Resuma o caso sem citar outros clientes.",
          processId: RT.processes.a.id,
        }),
      }),
    );
    const leaked = streamCapture.system.includes(RT_SECRET_MARKER_B);
    if (res.status < 500 && !leaked) report.pass("CE.M1 mock: system sem SEGREDO_BRAVO");
    else if (leaked) report.fail("CE.M1 vazamento no system", { severity: "P0" });
    expect(leaked).toBe(false);
  });

  it("CE.M2 processId B adulterado: system sem marcador B", async () => {
    if (!envOk || !fixturesOk) return;
    streamCapture.system = "";
    setPersona("commonA");
    await postCompletion(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "continue",
          selection: "Continue o texto.",
          processId: RT.processes.b.id,
        }),
      }),
    );
    const leaked = streamCapture.system.includes(RT_SECRET_MARKER_B);
    if (!leaked) report.pass("CE.M2 processId B adulterado sem chunk B no system");
    else report.fail("CE.M2 vazamento com processId B", { severity: "P0" });
    expect(leaked).toBe(false);
  });

  it("CE.M3 sem auth: provider não chamado", async () => {
    if (!envOk || !fixturesOk) return;
    providerCalled.n = 0;
    setPersona("none");
    let threw = false;
    try {
      await postCompletion(
        new Request("http://local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "continue", selection: "x" }),
        }),
      );
    } catch {
      threw = true;
    }
    if (threw && providerCalled.n === 0) report.pass("CE.M3 sem sessão não chama provider");
    else report.fail("CE.M3 provider chamado sem auth", { severity: "P0", obtained: `calls=${providerCalled.n}` });
    setPersona("commonA");
    expect(providerCalled.n).toBe(0);
  });

  it("CE.M4 rate limit antes de streamText no código", () => {
    const src = readFileSync(resolve(process.cwd(), "src/app/api/completion/route.ts"), "utf8");
    const ok =
      src.indexOf("await enforceAiRouteRateLimit") >= 0 &&
      src.indexOf("await retrieveContext") > src.indexOf("enforceAiRouteRateLimit") &&
      src.indexOf("streamText({") > src.indexOf("await retrieveContext");
    if (ok) report.pass("CE.M4 ordem RL → retrieve → streamText");
    else report.fail("CE.M4 ordem insegura", { severity: "P1" });
    expect(ok).toBe(true);
  });

  it("CE.M5 resposta mock sem marcador B", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await postCompletion(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "continue", selection: "Teste", processId: RT.processes.a.id }),
      }),
    );
    const body = await res.text();
    const bad =
      body.includes(RT_SECRET_MARKER_B) ||
      (body.includes("stack") && body.includes("at /home/"));
    if (!bad) report.pass("CE.M5 corpo da resposta sem marcador B nem stack");
    else report.fail("CE.M5 resposta vazou segredo ou stack", { severity: "P0" });
    expect(bad).toBe(false);
  });
});
