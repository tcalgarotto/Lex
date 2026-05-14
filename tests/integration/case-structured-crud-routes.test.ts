import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

let mockWorkspaceId = "";
const mockUserId = "test-user";

vi.mock("@/lib/auth/session", () => {
  return {
    getWorkspaceContext: vi.fn(async () => ({
      workspaceId: mockWorkspaceId,
      user: { id: mockUserId },
    })),
  };
});

import * as FactsRoute from "@/app/api/cases/[id]/facts/route";
import * as PartiesRoute from "@/app/api/cases/[id]/parties/route";
import * as RequestsRoute from "@/app/api/cases/[id]/requests/route";
import * as RisksRoute from "@/app/api/cases/[id]/risks/route";

async function createWorkspace(name: string) {
  const ws = await prisma.workspace.create({
    data: { name, slug: `${name}-${Math.random().toString(16).slice(2)}` },
    select: { id: true },
  });
  return ws.id;
}

async function createCase(workspaceId: string, title: string) {
  const c = await prisma.case.create({
    data: {
      workspaceId,
      createdById: mockUserId,
      title,
      summary: null,
      rawInput: "",
      status: "INTAKE",
    },
    select: { id: true },
  });
  return c.id;
}

describe("CRUD inline routes (multi-tenant)", () => {
  let wsA: string;
  let wsB: string;
  let caseA: string;

  beforeEach(async () => {
    wsA = await createWorkspace("wsA");
    wsB = await createWorkspace("wsB");
    caseA = await createCase(wsA, "Caso A");
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
  });

  it("facts: sucesso no workspace correto e 404 em outro workspace", async () => {
    mockWorkspaceId = wsA;
    const createdRes = await FactsRoute.POST(
      new Request("http://test.local/api/cases/x/facts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Fato manual", status: "editado", source: "manual", confidence: 0.9 }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    const factId = createdJson.fact.id as string;

    mockWorkspaceId = wsB;
    const updateRes = await FactsRoute.PATCH(
      new Request("http://test.local/api/cases/x/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: factId, text: "Tentativa fora do workspace" }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(updateRes.status).toBe(404);
  });

  it("parties: sucesso no workspace correto e 404 em outro workspace", async () => {
    mockWorkspaceId = wsA;
    const createdRes = await PartiesRoute.POST(
      new Request("http://test.local/api/cases/x/parties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "AUTHOR", kind: "PERSON", name: "Ana Paula", status: "editado", source: "manual", confidence: 0.88 }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    const partyId = createdJson.party.id as string;

    mockWorkspaceId = wsB;
    const delRes = await PartiesRoute.DELETE(
      new Request("http://test.local/api/cases/x/parties", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: partyId }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(delRes.status).toBe(404);
  });

  it("requests: sucesso no workspace correto e 404 em outro workspace", async () => {
    mockWorkspaceId = wsA;
    const createdRes = await RequestsRoute.POST(
      new Request("http://test.local/api/cases/x/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "MAIN", text: "Pedido principal", status: "editado", source: "manual", confidence: 0.77 }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    const requestId = createdJson.request.id as string;

    mockWorkspaceId = wsB;
    const updateRes = await RequestsRoute.PATCH(
      new Request("http://test.local/api/cases/x/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: requestId, text: "Alteração indevida" }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(updateRes.status).toBe(404);
  });

  it("risks: sucesso no workspace correto e 404 em outro workspace", async () => {
    mockWorkspaceId = wsA;
    const createdRes = await RisksRoute.POST(
      new Request("http://test.local/api/cases/x/risks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "OTHER",
          severity: "MEDIUM",
          title: "Falta de prova",
          detail: "Ainda não há documento que comprove o fato X.",
          status: "editado",
          source: "manual",
          confidence: 0.7,
        }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    const riskId = createdJson.risk.id as string;

    mockWorkspaceId = wsB;
    const delRes = await RisksRoute.DELETE(
      new Request("http://test.local/api/cases/x/risks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: riskId }),
      }),
      { params: Promise.resolve({ id: caseA }) },
    );
    expect(delRes.status).toBe(404);
  });
});

