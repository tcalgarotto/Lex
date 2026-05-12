import { describe, expect, it } from "vitest";
import { WorkspaceLicense } from "@prisma/client";
import { workspaceLicenseSeatCap, workspaceWouldFitOccupancy } from "@/lib/billing/workspace-license";

describe("workspaceLicenseSeatCap", () => {
  it("fixa limites por plano nomeado", () => {
    expect(workspaceLicenseSeatCap(WorkspaceLicense.INVESTOR, null)).toBe(3);
    expect(workspaceLicenseSeatCap(WorkspaceLicense.SOLO, null)).toBe(1);
    expect(workspaceLicenseSeatCap(WorkspaceLicense.DUO, null)).toBe(2);
    expect(workspaceLicenseSeatCap(WorkspaceLicense.TEAM, null)).toBe(4);
  });

  it("ENTERPRISE sem custom = ilimitado", () => {
    expect(workspaceLicenseSeatCap(WorkspaceLicense.ENTERPRISE, null)).toBeNull();
  });

  it("ENTERPRISE com custom aplica teto", () => {
    expect(workspaceLicenseSeatCap(WorkspaceLicense.ENTERPRISE, 50)).toBe(50);
  });
});

describe("workspaceWouldFitOccupancy", () => {
  it("permite upgrade quando já cabia no plano antigo", () => {
    expect(workspaceWouldFitOccupancy(1, WorkspaceLicense.DUO, null)).toBe(true);
  });

  it("bloqueia downgrade quando ocupação excede o novo teto", () => {
    expect(workspaceWouldFitOccupancy(3, WorkspaceLicense.SOLO, null)).toBe(false);
  });

  it("ENTERPRISE ilimitado sempre cabe", () => {
    expect(workspaceWouldFitOccupancy(999, WorkspaceLicense.ENTERPRISE, null)).toBe(true);
  });
});
