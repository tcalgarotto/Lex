/**
 * FASE 5.2 — QA manual jurídico assistido (fixtures falsas; handlers + Auth opcional).
 * Complementa `docs/security/LEGAL_QA_MANUAL_CHECKLIST.md`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { assertRedTeamSafeEnvironment } from "../../../scripts/security-audit/env-guard";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";
import {
  attackState,
  setPersona,
  RedTeamReport,
  readJson,
  bodyContainsSecretB,
  assertRedTeamDatabaseReachable,
} from "./helpers";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { vi } from "vitest";
import { GET as listCases } from "@/app/api/cases/route";
import { GET as getDocument } from "@/app/api/documents/[documentId]/route";
import { GET as getDocumentFile } from "@/app/api/documents/[documentId]/file/route";
import { POST as uploadDocument } from "@/app/api/documents/upload/route";
import { GET as getRetrievalSearch } from "@/app/api/retrieval/search/route";
import { POST as postStrategyGenerate } from "@/app/api/cases/[id]/strategy/generate/route";
import { POST as postCompletion } from "@/app/api/completion/route";
import { retrieveContext } from "@/lib/retrieval/hybrid-retriever";
import { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";

vi.mock("@/lib/auth/session", async () => ({
  getWorkspaceContext: vi.fn(async () => {
    if (!attackState.userId) throw new Error("Não autenticado");
    return {
      workspaceId: attackState.workspaceId,
      user: { id: attackState.userId, email: attackState.email },
    };
  }),
  getWorkspaceContextWithRole: vi.fn(async () => {
    if (!attackState.userId || !attackState.role) throw new Error("Sem associação");
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
    if (!attackState.role) throw new Error("Sem role");
    if (!can(attackState.role, permission)) throw new Error(`Permissão: ${permission}`);
    return {
      user: { id: attackState.userId, email: attackState.email },
      workspaceId: attackState.workspaceId,
      role: attackState.role,
    };
  }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    uploadDocumentBuffer: vi.fn().mockResolvedValue(undefined),
    downloadDocumentBuffer: vi.fn().mockRejectedValue(new Error("mock download")),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["mock"] }) },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => void | Promise<void>) => {
      void fn();
    },
  };
});

const report = new RedTeamReport();
let envOk = false;
let fixturesOk = false;

function makeTextFile(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

function makeFakePdfFile(): File {
  return new File(["hello"], "fake.pdf", { type: "application/pdf" });
}

beforeAll(async () => {
  const guard = assertRedTeamSafeEnvironment();
  envOk = guard.ok;
  if (!envOk) {
    report.skip("LQA ambiente", guard.ok === false ? guard.reason : "?");
    return;
  }
  const db = await assertRedTeamDatabaseReachable();
  if (!db.ok) {
    envOk = false;
    report.skip("LQA DB", db.ok === false ? db.reason : "?");
    return;
  }
  fixturesOk = Boolean(await prisma.case.findFirst({ where: { id: RT.cases.a.id } }));
  if (!fixturesOk) report.skip("LQA fixtures", "npm run security:red-team:seed");
});

afterAll(() => report.print());

describe("FASE 5.2 — QA manual assistido", () => {
  it("LQA.1 Auth Supabase login/logout (se credenciais staging no .env)", async () => {
    if (!envOk) return;
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
    const anon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim();
    const email = process.env["SUPABASE_TEST_USER_A_EMAIL"]?.trim() || RT.users.commonA.email;
    const password = process.env["SUPABASE_TEST_USER_A_PASSWORD"]?.trim();
    if (!url || !anon || !password) {
      report.skip("LQA.1 login UI", "Credenciais Supabase teste ausentes — validar login no browser em staging");
      return;
    }
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) {
      report.fail("LQA.1 Supabase signIn", { severity: "P1", obtained: signErr?.message?.slice(0, 80) });
      expect(signErr).toBeNull();
      return;
    }
    const { error: signOutErr } = await sb.auth.signOut();
    if (!signOutErr) report.pass("LQA.1 Auth login + logout Supabase (fixture A)");
    else report.fail("LQA.1 logout", { severity: "P2", obtained: signOutErr.message });
    expect(signOutErr).toBeNull();
  });

  it("LQA.2–3 Fixtures workspace A/B e lista sem caso Bravo", async () => {
    if (!envOk || !fixturesOk) return;
    const wsA = await prisma.workspace.findUnique({ where: { id: RT.workspaces.a.id } });
    const wsB = await prisma.workspace.findUnique({ where: { id: RT.workspaces.b.id } });
    expect(wsA?.slug).toContain("redteam");
    setPersona("commonA");
    const res = await listCases(new Request("http://local/api/cases"));
    const json = await readJson(res);
    const leak = bodyContainsSecretB(json);
    if (wsA && wsB && !leak) report.pass("LQA.2–3 workspaces fake; listagem A sem dados Bravo");
    else report.fail("LQA.3 vazamento na listagem", { severity: "P0" });
    expect(leak).toBe(false);
  });

  it("LQA.4–5 Cliente e caso fake presentes", async () => {
    if (!envOk || !fixturesOk) return;
    const client = await prisma.client.findFirst({ where: { id: RT.clients.a.id } });
    const caso = await prisma.case.findFirst({ where: { id: RT.cases.a.id } });
    if (client && caso) report.pass("LQA.4–5 cliente/caso fixture Alfa no DB");
    else report.fail("LQA.4–5 fixtures", { severity: "P1" });
    expect(client).toBeTruthy();
    expect(caso).toBeTruthy();
  });

  it("LQA.6 Upload válido (text/plain)", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const fd = new FormData();
    fd.set("file", makeTextFile("qa-fake.txt", "Conteúdo fictício QA manual assistido."));
    fd.set("caseId", RT.cases.a.id);
    const res = await uploadDocument(new Request("http://local/api/documents/upload", { method: "POST", body: fd }));
    if (res.status === 200) report.pass("LQA.6 upload válido aceito");
    else report.fail("LQA.6 upload", { severity: "P1", obtained: String(res.status) });
    expect(res.status).toBe(200);
  });

  it("LQA.7 PDF falso → 415", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const fd = new FormData();
    fd.set("file", makeFakePdfFile());
    fd.set("caseId", RT.cases.a.id);
    const res = await uploadDocument(new Request("http://local/api/documents/upload", { method: "POST", body: fd }));
    if (res.status === 415) report.pass("LQA.7 PDF falso rejeitado (415)");
    else report.fail("LQA.7 PDF falso", { severity: "P0", obtained: String(res.status) });
    expect(res.status).toBe(415);
  });

  it("LQA.8–9 Documento próprio vs cross-tenant", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const own = await getDocument(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.a.id }),
    });
    const cross = await getDocument(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.b.id }),
    });
    const fileCross = await getDocumentFile(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.b.id }),
    });
    if (own.status === 200 && cross.status === 404 && fileCross.status === 404) {
      report.pass("LQA.8–9 metadados/download doc B bloqueados (404)");
    } else {
      report.fail("LQA.9 cross-tenant doc", {
        severity: "P0",
        obtained: `own=${own.status} cross=${cross.status} file=${fileCross.status}`,
      });
    }
    expect(cross.status).toBe(404);
  });

  it("LQA.10 Pesquisa sem vazamento Bravo", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await getRetrievalSearch(
      new Request(
        `http://local/api/retrieval/search?q=${encodeURIComponent("confidencial")}&layers=caso&caseId=${RT.cases.a.id}`,
      ),
    );
    const json = await readJson(res);
    if (!bodyContainsSecretB(json)) report.pass("LQA.10 pesquisa caso A sem marcador B");
    else report.fail("LQA.10 pesquisa vazou B", { severity: "P0" });
    expect(bodyContainsSecretB(json)).toBe(false);
  });

  it("LQA.11 Estratégia caso B → 404", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await postStrategyGenerate(
      new Request("http://local", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ id: RT.cases.b.id }) },
    );
    if (res.status === 404) report.pass("LQA.11 estratégia caso B bloqueada");
    else report.fail("LQA.11 estratégia cross-case", { severity: "P0", obtained: String(res.status) });
    expect(res.status).toBe(404);
  });

  it("LQA.12–13 RAG/completion sem marcador Bravo", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const { chunks } = await retrieveContext({
      workspaceId: RT.workspaces.a.id,
      query: RT_SECRET_MARKER_B,
      limit: 12,
      userId: RT.users.commonA.id,
    });
    const leak = chunks.some((c) => c.text.includes(RT_SECRET_MARKER_B));
    if (!leak) report.pass("LQA.12–13 retrieveContext A sem segredo Bravo");
    else report.fail("LQA.13 RAG vazou Bravo", { severity: "P0" });
    expect(leak).toBe(false);
  });

  it("LQA.14 Erro IA sanitizado (sem stack na mensagem usuário)", async () => {
    const n = normalizeAiProviderError(new Error("DEEPSEEK_API_KEY missing\n    at /secret/path.ts:99"));
    const bad =
      n.userMessage.includes("at ") ||
      n.userMessage.includes(".ts:") ||
      n.userMessage.includes("sk-");
    if (!bad) report.pass("LQA.14 normalizeAiProviderError sem stack/key");
    else report.fail("LQA.14 erro expõe detalhe", { severity: "P1" });
    expect(bad).toBe(false);
  });

  it("LQA.15 Logs código: sem console.log de prompt/PDF em rotas API", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const root = process.cwd();
    const bad: string[] = [];
    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (!name.includes("node_modules")) walk(p);
        } else if (name === "route.ts") {
          const rel = p.replace(root + "/", "");
          const src = readFileSync(p, "utf8");
          if (/console\.(log|info)\([^)]*(extractedText|selection|messages)/i.test(src)) bad.push(rel);
        }
      }
    }
    walk(join(root, "src/app/api"));
    if (bad.length === 0) report.pass("LQA.15 estático: rotas API sem log óbvio de conteúdo");
    else report.fail("LQA.15 logs sensíveis em rota", { severity: "P2", obtained: bad.join(", ") });
    expect(bad).toEqual([]);
  });
});
