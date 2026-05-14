import { describe, expect, it } from "vitest";
import { formatBytesHumanIec } from "@/lib/storage/storage-quota";
import { storagePlanCodeForWorkspaceLicense, storagePlanDisplayName, STORAGE_PLAN } from "@/lib/billing/storage-plans";
import { WorkspaceLicense } from "@prisma/client";

describe("formatBytesHumanIec", () => {
  it("formata 2 GiB corretamente", () => {
    expect(formatBytesHumanIec(2147483648n)).toMatch(/2(\.00)?\s+GB/);
  });

  it("formata zero", () => {
    expect(formatBytesHumanIec(0n)).toBe("0 B");
  });
});

describe("storage-plans", () => {
  it("mapeia licença para plano de armazenamento", () => {
    expect(storagePlanCodeForWorkspaceLicense(WorkspaceLicense.SOLO)).toBe(STORAGE_PLAN.BASIC);
    expect(storagePlanDisplayName("BASIC")).toBeTruthy();
  });
});
