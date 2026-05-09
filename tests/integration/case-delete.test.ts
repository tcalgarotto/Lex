import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

let mockWorkspaceId = "";
let mockUserId = "test-user";

const mocks = vi.hoisted(() => {
  return {
    removeDocumentBuffer: vi.fn(async () => undefined),
    deleteByDocumentId: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/auth/session", () => {
  return {
    getWorkspaceContext: vi.fn(async () => ({
      workspaceId: mockWorkspaceId,
      user: { id: mockUserId },
    })),
  };
});

vi.mock("@/lib/storage", () => {
  return { removeDocumentBuffer: mocks.removeDocumentBuffer };
});

vi.mock("@/lib/retrieval/vector-store/qdrant-store", () => {
  return {
    getQdrantVectorStore: () => ({ deleteByDocumentId: mocks.deleteByDocumentId }),
  };
});

import * as DeleteRoute from "@/app/api/cases/[id]/delete/route";

async function createWorkspace(name: string) {
  const ws = await prisma.workspace.create({
    data: { name, slug: `${name}-${Math.random().toString(16).slice(2)}` },
    select: { id: true },
  });
  return ws.id;
}

async function createCase(workspaceId: string) {
  const c = await prisma.case.create({
    data: {
      workspaceId,
      createdById: mockUserId,
      title: "Caso delete",
      summary: null,
      rawInput: "",
      status: "INTAKE",
    },
    select: { id: true },
  });
  return c.id;
}

async function createDoc(workspaceId: string, caseId: string) {
  const d = await prisma.document.create({
    data: {
      workspaceId,
      caseId,
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: `documents/${workspaceId}/${Math.random().toString(16).slice(2)}.pdf`,
      status: "UPLOADED",
      progress: 0,
    },
    select: { id: true, storagePath: true },
  });
  return d;
}

describe("case delete (multi-tenant + cleanup best-effort)", () => {
  let wsA: string;
  let wsB: string;
  let caseA: string;

  beforeEach(async () => {
    wsA = await createWorkspace("wsA-case-delete");
    wsB = await createWorkspace("wsB-case-delete");
    caseA = await createCase(wsA);
    await createDoc(wsA, caseA);
    mocks.deleteByDocumentId.mockClear();
    mocks.removeDocumentBuffer.mockClear();
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
  });

  it("exige confirm=1 e bloqueia cross-workspace", async () => {
    mockWorkspaceId = wsA;
    const badConfirm = await DeleteRoute.DELETE(
      new Request("http://test.local/api/cases/x/delete"),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(badConfirm.status).toBe(400);

    mockWorkspaceId = wsB;
    const denied = await DeleteRoute.DELETE(
      new Request("http://test.local/api/cases/x/delete?confirm=1"),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(denied.status).toBe(404);
  });

  it("remove caso no workspace correto e chama cleanup de docs", async () => {
    mockWorkspaceId = wsA;
    const ok = await DeleteRoute.DELETE(
      new Request("http://test.local/api/cases/x/delete?confirm=1"),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(ok.status).toBe(200);
    expect(mocks.deleteByDocumentId).toHaveBeenCalledTimes(1);
    expect(mocks.removeDocumentBuffer).toHaveBeenCalledTimes(1);

    const stillThere = await prisma.case.findFirst({ where: { id: caseA, workspaceId: wsA } });
    expect(stillThere).toBeNull();
  });
});

