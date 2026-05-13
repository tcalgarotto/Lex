import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

let mockWorkspaceId = "";
let mockUserId = "test-user";

vi.mock("@/lib/auth/session", () => {
  return {
    getWorkspaceContext: vi.fn(async () => ({
      workspaceId: mockWorkspaceId,
      user: { id: mockUserId },
    })),
  };
});

import * as FoundationsRoute from "@/app/api/library/foundations/route";
import * as FoundationRoute from "@/app/api/library/foundations/[id]/route";

async function createWorkspace(name: string) {
  const ws = await prisma.workspace.create({
    data: { name, slug: `${name}-${Math.random().toString(16).slice(2)}` },
    select: { id: true },
  });
  return ws.id;
}

describe("library foundations (multi-tenant)", () => {
  let wsA: string;
  let wsB: string;
  let createdId = "";

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: { id: mockUserId, email: `${mockUserId}@test.local`, name: "Test User" },
    });
    wsA = await createWorkspace("wsA-lib");
    wsB = await createWorkspace("wsB-lib");
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
    await prisma.user.deleteMany({ where: { id: mockUserId } });
  });

  it("cria/lista no workspace correto e bloqueia leitura fora do workspace", async () => {
    mockWorkspaceId = wsA;
    const createRes = await FoundationsRoute.POST(
      new Request("http://test.local/api/library/foundations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Fundamento A",
          contentMd: "Conteúdo suficientemente longo para teste.",
          tags: ["saúde"],
          optInSearch: false,
          optInMemory: true,
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    createdId = created.id;

    const listRes = await FoundationsRoute.GET(new Request("http://test.local/api/library/foundations"));
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { foundations: Array<{ id: string }> };
    expect(listJson.foundations.some((f) => f.id === createdId)).toBe(true);

    mockWorkspaceId = wsB;
    const denied = await FoundationRoute.GET(
      new Request("http://test.local/api/library/foundations/x"),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(denied.status).toBe(404);
  });

  it("exige confirm=1 para delete e marca deletedAt", async () => {
    mockWorkspaceId = wsA;
    const createRes = await FoundationsRoute.POST(
      new Request("http://test.local/api/library/foundations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Fundamento B",
          contentMd: "Conteúdo suficientemente longo para teste.",
        }),
      }),
    );
    const { id } = (await createRes.json()) as { id: string };

    const bad = await FoundationRoute.DELETE(
      new Request("http://test.local/api/library/foundations/x", { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
    expect(bad.status).toBe(400);

    const ok = await FoundationRoute.DELETE(
      new Request("http://test.local/api/library/foundations/x?confirm=1", { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
    expect(ok.status).toBe(200);

    const db = await prisma.libraryFoundation.findFirst({ where: { id, workspaceId: wsA } });
    expect(db?.deletedAt).not.toBeNull();
  });
});

