/**
 * FASE 3 — Storage / upload / download cross-tenant (integração real de handlers + Prisma).
 * Não chama Supabase Storage diretamente; valida autorização app-side antes de service_role.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { assertRedTeamSafeEnvironment } from "../../../scripts/security-audit/env-guard";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";
import {
  attackState,
  setPersona,
  RedTeamReport,
  readJson,
  bodyContainsSecretB,
  assertBlockedStatus,
} from "./helpers";
import { prisma } from "@/lib/prisma";
import { documentStoragePath } from "@/lib/storage";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    uploadDocumentBuffer: vi.fn().mockResolvedValue(undefined),
    removeDocumentBuffer: vi.fn().mockResolvedValue(undefined),
    downloadDocumentBuffer: vi.fn().mockRejectedValue(new Error("mock: no storage in test")),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["mock"] }) },
}));

vi.mock("@/lib/auth/session", async () => {
  const { can } = await import("@/lib/auth/permissions");
  return {
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
      if (!can(attackState.role, permission)) throw new Error(`Permissão insuficiente: ${permission}`);
      return {
        user: { id: attackState.userId, email: attackState.email },
        workspaceId: attackState.workspaceId,
        role: attackState.role,
      };
    }),
  };
});

import { GET as getDocumentFile } from "@/app/api/documents/[documentId]/file/route";
import { GET as getDocument } from "@/app/api/documents/[documentId]/route";
import { GET as getThumbnail } from "@/app/api/documents/[documentId]/thumbnail/route";
import { GET as getExtractedText } from "@/app/api/cases/[id]/documents/[docId]/extracted-text/route";
import { POST as uploadDocument } from "@/app/api/documents/upload/route";
import { POST as uploadCaseDocument } from "@/app/api/cases/[id]/documents/route";
import { uploadDocumentBuffer } from "@/lib/storage";
import { assertCanUploadFileToWorkspace } from "@/lib/storage/storage-quota";

const report = new RedTeamReport();
let envOk = false;
let fixturesOk = false;

async function fixturesPresent(): Promise<boolean> {
  const c = await prisma.case.findFirst({ where: { id: RT.cases.b.id } });
  return Boolean(c);
}

function makeTextFile(name: string, content: string, mime = "text/plain"): File {
  return new File([content], name, { type: mime });
}

beforeAll(async () => {
  const guard = assertRedTeamSafeEnvironment();
  envOk = guard.ok;
  if (!envOk) {
    report.skip("Ambiente", guard.ok === false ? guard.reason : "desconhecido");
    return;
  }
  fixturesOk = await fixturesPresent();
  if (!fixturesOk) {
    report.skip("Fixtures red-team", "Execute: npm run security:red-team:seed");
  }
});

afterAll(() => {
  report.print();
  const p0 = report.findings.filter((f) => f.status === "FALHOU" && f.severity === "P0");
  if (envOk && fixturesOk && p0.length > 0) {
    throw new Error(`FASE 3 storage: ${p0.length} falha(s) P0`);
  }
});

describe("FASE 3 — Storage / RLS (app layer)", () => {
  // ─── BLOCO 2 — Download cross-tenant ───────────────────────────
  it("S3.1 GET /file documento B → bloqueado, sem bytes sigilosos", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await getDocumentFile(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.b.id }),
    });
    const body = new TextDecoder().decode(await res.arrayBuffer());
    if (assertBlockedStatus(res.status) && !body.includes(RT_SECRET_MARKER_B)) {
      report.pass("S3.1 GET /file doc B bloqueado", { obtained: String(res.status) });
    } else {
      report.fail("S3.1 vazamento arquivo B", {
        severity: "P0",
        route: "GET /api/documents/[id]/file",
        obtained: `${res.status} len=${body.length}`,
      });
    }
    expect(res.status).not.toBe(200);
  });

  it("S3.2 GET metadados documento B sem nome Bravo", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await getDocument(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.b.id }),
    });
    const json = await readJson(res);
    const s = JSON.stringify(json);
    if (assertBlockedStatus(res.status) && !s.includes(RT.documents.b.name) && !bodyContainsSecretB(json)) {
      report.pass("S3.2 metadados doc B bloqueados", { obtained: String(res.status) });
    } else {
      report.fail("S3.2 metadados doc B vazaram", { severity: "P0", obtained: s.slice(0, 120) });
    }
    expect(assertBlockedStatus(res.status)).toBe(true);
  });

  it("S3.3 thumbnail documento B → 404/403", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await getThumbnail(new Request("http://local"), {
      params: Promise.resolve({ documentId: RT.documents.b.id }),
    });
    if (assertBlockedStatus(res.status)) {
      report.pass("S3.3 thumbnail doc B bloqueado", { obtained: String(res.status) });
    } else {
      report.fail("S3.3 thumbnail doc B acessível", { severity: "P0", obtained: String(res.status) });
    }
    expect(assertBlockedStatus(res.status)).toBe(true);
  });

  it("S3.4 extracted-text caso B/doc B → 404", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const res = await getExtractedText(new Request("http://local"), {
      params: Promise.resolve({ id: RT.cases.b.id, docId: RT.documents.b.id }),
    });
    expect(res.status).toBe(404);
    report.pass("S3.4 extracted-text cross-tenant → 404", { obtained: "404" });
  });

  it("S3.5 path previsível sanitizado (sem traversal)", () => {
    const p1 = documentStoragePath(RT.workspaces.b.id, RT.documents.b.id, "../evil.pdf");
    const p2 = documentStoragePath(RT.workspaces.a.id, RT.documents.a.id, "..%2Fevil.pdf");
    expect(p1).not.toContain("/../");
    expect(p1).toBe(`${RT.workspaces.b.id}/${RT.documents.b.id}/.._evil.pdf`);
    expect(p2).not.toContain("/../");
    expect(p2.startsWith(`${RT.workspaces.a.id}/${RT.documents.a.id}/`)).toBe(true);
    report.pass("S3.5 documentStoragePath neutraliza traversal", {
      obtained: p1,
    });
  });

  // ─── BLOCO 3 — Upload multipart (handler) ───────────────────────
  it("S3.6 upload válido workspace A (text/plain)", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const before = await prisma.document.count({ where: { workspaceId: RT.workspaces.a.id } });
    const form = new FormData();
    form.append("file", makeTextFile("redteam-a-test.txt", "conteudo fake A"));
    form.append("caseId", RT.cases.a.id);
    const res = await uploadDocument(
      new Request("http://local/api/documents/upload", { method: "POST", body: form }),
    );
    if (res.status === 201 || res.status === 200) {
      report.pass("S3.6 upload A aceito", { obtained: String(res.status) });
      expect(vi.mocked(uploadDocumentBuffer)).toHaveBeenCalled();
    } else if (res.status === 429 || res.status === 503) {
      report.skip("S3.6 upload A", `rate limit / fail-closed: ${res.status}`);
    } else {
      report.fail("S3.6 upload A falhou inesperado", { severity: "P1", obtained: String(res.status) });
    }
    const after = await prisma.document.count({ where: { workspaceId: RT.workspaces.a.id } });
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("S3.7 upload com caseId B bloqueado", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    vi.mocked(uploadDocumentBuffer).mockClear();
    const form = new FormData();
    form.append("file", makeTextFile("evil.txt", "x"));
    form.append("caseId", RT.cases.b.id);
    const res = await uploadDocument(
      new Request("http://local/api/documents/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(404);
    expect(vi.mocked(uploadDocumentBuffer)).not.toHaveBeenCalled();
    report.pass("S3.7 upload caseId B → 404", { obtained: "404" });
  });

  it("S3.8 upload em rota caso B bloqueado", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const form = new FormData();
    form.append("file", makeTextFile("evil.txt", "x"));
    const res = await uploadCaseDocument(
      new Request("http://local", { method: "POST", body: form }),
      { params: Promise.resolve({ id: RT.cases.b.id }) },
    );
    expect(res.status).toBe(404);
    report.pass("S3.8 POST /cases/{caseB}/documents → 404", { obtained: "404" });
  });

  it("S3.9b PDF falso → 415 sem chamar storage", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    vi.mocked(uploadDocumentBuffer).mockClear();
    const form = new FormData();
    form.append("file", new File(["hello"], "fake.pdf", { type: "application/pdf" }));
    const res = await uploadDocument(
      new Request("http://local/api/documents/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(415);
    expect(vi.mocked(uploadDocumentBuffer)).not.toHaveBeenCalled();
    report.pass("S3.9b PDF falso → 415", { obtained: "415" });
  });

  it("S3.9 MIME não permitido bloqueado", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    const form = new FormData();
    form.append("file", makeTextFile("evil.exe", "MZ", "application/x-msdownload"));
    const res = await uploadDocument(
      new Request("http://local/api/documents/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(415);
    report.pass("S3.9 MIME inválido → 415", { obtained: "415" });
  });

  it("S3.10 sem sessão → erro antes de upload", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("none");
    const form = new FormData();
    form.append("file", makeTextFile("x.txt", "a"));
    await expect(
      uploadDocument(new Request("http://local", { method: "POST", body: form })),
    ).rejects.toThrow(/autenticado|associação/i);
    report.pass("S3.10 upload sem sessão rejeitado");
    setPersona("commonA");
  });

  // ─── BLOCO 7 — Quota cross-tenant ───────────────────────────────
  it("S3.12 PDF falso não chama storage nem cria documento", async () => {
    if (!envOk || !fixturesOk) return;
    setPersona("commonA");
    vi.mocked(uploadDocumentBuffer).mockClear();
    const before = await prisma.document.count({ where: { workspaceId: RT.workspaces.a.id } });
    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("hello", "utf8")], "fake.pdf", { type: "application/pdf" }),
    );
    const res = await uploadDocument(
      new Request("http://local/api/documents/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(415);
    expect(vi.mocked(uploadDocumentBuffer)).not.toHaveBeenCalled();
    const after = await prisma.document.count({ where: { workspaceId: RT.workspaces.a.id } });
    expect(after).toBe(before);
    report.pass("S3.12 PDF inválido → 415 sem storage/DB", { obtained: "415" });
  });

  it("S3.11 quota workspace B não afetada por assert em A", async () => {
    if (!envOk || !fixturesOk) return;
    const usedBBefore = await prisma.document.aggregate({
      where: { workspaceId: RT.workspaces.b.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId: RT.workspaces.a.id, fileSizeBytes: 100 }),
    ).resolves.toBeUndefined();
    const usedBAfter = await prisma.document.aggregate({
      where: { workspaceId: RT.workspaces.b.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    expect(usedBBefore._sum.sizeBytes).toBe(usedBAfter._sum.sizeBytes);
    report.pass("S3.11 quota B inalterada por operação em A");
  });
});
