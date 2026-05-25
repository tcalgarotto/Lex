import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findFirst },
    client: { findFirst: vi.fn() },
    case: { findFirst: vi.fn() },
  },
}));

import { CrmNotFoundError } from "@/lib/justos/crm/permissions";
import { getCrmContact } from "@/lib/justos/crm/contact-service";

describe("CRM workspace isolation", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("não retorna contato de outro workspace (404)", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      getCrmContact({ workspaceId: "ws_A", contactId: "contact_from_B" }),
    ).rejects.toBeInstanceOf(CrmNotFoundError);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "contact_from_B", workspaceId: "ws_A", deletedAt: null },
    });
  });

  it("retorna contato quando workspace coincide", async () => {
    const row = {
      id: "c1",
      workspaceId: "ws_A",
      displayName: "Test",
      kind: "CLIENT",
      pipelineStage: "NEW",
      optOutWhatsapp: false,
      phoneE164: null,
      email: null,
      documentId: null,
      clientId: null,
      caseId: null,
      metadataJson: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    findFirst.mockResolvedValue(row);
    const got = await getCrmContact({ workspaceId: "ws_A", contactId: "c1" });
    expect(got.workspaceId).toBe("ws_A");
  });
});
