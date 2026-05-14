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

import * as ExportRoute from "@/app/api/cases/[id]/drafts/[draftId]/export/route";

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
      title: "Caso export",
      summary: null,
      rawInput: "",
      status: "DRAFTING",
    },
    select: { id: true },
  });
  return c.id;
}

async function createDraft(caseId: string) {
  const d = await prisma.caseDraft.create({
    data: {
      caseId,
      version: 1,
      status: "GENERATED",
      content: "## I. Endereçamento\n\nTexto curto de teste.\n\n## II. Qualificação\n\nParte A.",
      groundingChunkIds: [],
      metadataJson: {},
    },
    select: { id: true },
  });
  return d.id;
}

describe("case draft export (multi-tenant)", () => {
  let wsA: string;
  let wsB: string;
  let caseA: string;
  let draftA: string;

  beforeEach(async () => {
    wsA = await createWorkspace("wsA-export");
    wsB = await createWorkspace("wsB-export");
    caseA = await createCase(wsA);
    draftA = await createDraft(caseA);
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
  });

  it("exporta md/docx/pdf no workspace correto e bloqueia fora do workspace", async () => {
    mockWorkspaceId = wsA;

    const mdRes = await ExportRoute.GET(
      new Request(`http://test.local/api/cases/x/drafts/x/export?format=md`),
      { params: Promise.resolve({ id: caseA, draftId: draftA }) },
    );
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers.get("content-type") ?? "").toContain("text/markdown");

    const docxRes = await ExportRoute.GET(
      new Request(`http://test.local/api/cases/x/drafts/x/export?format=docx`),
      { params: Promise.resolve({ id: caseA, draftId: draftA }) },
    );
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers.get("content-type") ?? "").toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const pdfRes = await ExportRoute.GET(
      new Request(`http://test.local/api/cases/x/drafts/x/export?format=pdf`),
      { params: Promise.resolve({ id: caseA, draftId: draftA }) },
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type") ?? "").toContain("application/pdf");

    mockWorkspaceId = wsB;
    const denied = await ExportRoute.GET(
      new Request(`http://test.local/api/cases/x/drafts/x/export?format=md`),
      { params: Promise.resolve({ id: caseA, draftId: draftA }) },
    );
    expect(denied.status).toBe(404);
  });
});

