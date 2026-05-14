import { test, expect } from "@playwright/test";

/** APIs privadas devem responder 401 sem cookie de sessão. */
test.describe("api auth required", () => {
  for (const route of [
    "/api/invitations",
    "/api/workspaces/active",
    "/api/processes/x/documents",
    "/api/search",
    "/api/completion",
    "/api/strategy/analyze?q=x",
    "/api/lawyer-brain",
    "/api/integrations",
    "/api/alerts",
    "/api/notifications",
    "/api/admin/corpus-stats",
    "/api/office-memory",
  ]) {
    test(`GET ${route} -> 401 sem auth`, async ({ request, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const res = await request.get(route, {
        headers: { Origin: origin },
      });
      expect(res.status()).toBe(401);
    });
  }

  test("POST /api/legal-research/recommend-for-case -> 401 SESSION_REQUIRED sem auth", async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const res = await request.post("/api/legal-research/recommend-for-case", {
      data: {
        caseId: "clq1e2e000000000000000001",
        query: "ab",
        resultTypes: ["LAW"],
      },
      headers: { Origin: origin },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SESSION_REQUIRED");
  });

  test("POST /api/legal-research/pin -> 401 SESSION_REQUIRED sem auth", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const res = await request.post("/api/legal-research/pin", {
      data: {
        caseId: "clq1e2e000000000000000001",
        foundation: {
          id: "e2e-x",
          type: "LAW",
          title: "Título",
          citation: "Ref",
          excerpt: "Trecho mínimo para validação de payload.",
        },
      },
      headers: { Origin: origin },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SESSION_REQUIRED");
  });
});
