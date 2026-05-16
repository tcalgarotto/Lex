import { describe, it, expect } from "vitest";
import { assertDocumentIngestTenant } from "@/lib/inngest/functions/ingest-document";
import { RT } from "./fixture-ids";

describe("ingest-document tenant guard", () => {
  it("aceita evento A + documento A", () => {
    expect(() =>
      assertDocumentIngestTenant(
        { workspaceId: RT.workspaces.a.id },
        RT.workspaces.a.id,
      ),
    ).not.toThrow();
  });

  it("rejeita evento A tentando documento B", () => {
    expect(() =>
      assertDocumentIngestTenant(
        { workspaceId: RT.workspaces.b.id },
        RT.workspaces.a.id,
      ),
    ).toThrow(/workspace do evento/i);
  });

  it("aceita evento sem workspaceId (legado) após load por id", () => {
    expect(() =>
      assertDocumentIngestTenant({ workspaceId: RT.workspaces.b.id }, undefined),
    ).not.toThrow();
  });
});
