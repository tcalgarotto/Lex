import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

let mockWorkspaceId = "";
let mockUserId = "test-user-office-memory";

vi.mock("@/lib/auth/session", () => {
  return {
    getWorkspaceContext: vi.fn(async () => ({
      workspaceId: mockWorkspaceId,
      user: { id: mockUserId },
    })),
  };
});

import * as OfficeMemoryRoute from "@/app/api/office-memory/route";
import * as OfficeMemoryIdRoute from "@/app/api/office-memory/[id]/route";

async function createWorkspace(name: string) {
  const ws = await prisma.workspace.create({
    data: { name, slug: `${name}-${Math.random().toString(16).slice(2)}` },
    select: { id: true },
  });
  return ws.id;
}

describe("office memory (multi-tenant)", () => {
  let wsA: string;
  let wsB: string;
  let caseId = "";

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: { id: mockUserId, email: `${mockUserId}@test.local`, name: "Test User OM" },
    });
    wsA = await createWorkspace("wsA-om");
    wsB = await createWorkspace("wsB-om");
    const c = await prisma.case.create({
      data: {
        workspaceId: wsA,
        createdById: mockUserId,
        title: "Caso OM",
        rawInput: "Relato de teste para OfficeMemory.",
        status: "INTAKE",
      },
      select: { id: true },
    });
    caseId = c.id;
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
    await prisma.user.deleteMany({ where: { id: mockUserId } });
  });

  it("cria no workspace, lista e bloqueia GET fora do workspace", async () => {
    mockWorkspaceId = wsA;
    const createRes = await OfficeMemoryRoute.POST(
      new Request("http://test.local/api/office-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Mem A",
          contentMd: "Texto mínimo.",
          scope: "WORKSPACE",
          optInRag: false,
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const { id } = (await createRes.json()) as { id: string };

    const listRes = await OfficeMemoryRoute.GET(new Request("http://test.local/api/office-memory"));
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { memories: Array<{ id: string }> };
    expect(listJson.memories.some((m) => m.id === id)).toBe(true);

    mockWorkspaceId = wsB;
    const denied = await OfficeMemoryIdRoute.GET(
      new Request("http://test.local/api/office-memory/x"),
      { params: Promise.resolve({ id }) },
    );
    expect(denied.status).toBe(404);
  });

  it("exige caseId válido para escopo CASE", async () => {
    mockWorkspaceId = wsA;
    const bad = await OfficeMemoryRoute.POST(
      new Request("http://test.local/api/office-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Mem caso",
          contentMd: "Conteúdo.",
          scope: "CASE",
        }),
      }),
    );
    expect(bad.status).toBe(400);

    const ok = await OfficeMemoryRoute.POST(
      new Request("http://test.local/api/office-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Mem caso",
          contentMd: "Conteúdo.",
          scope: "CASE",
          caseId,
        }),
      }),
    );
    expect(ok.status).toBe(201);
  });
});
