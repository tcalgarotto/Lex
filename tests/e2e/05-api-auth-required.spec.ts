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
  ]) {
    test(`GET ${route} -> 401 sem auth`, async ({ request, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const res = await request.get(route, {
        headers: { Origin: origin },
      });
      expect(res.status()).toBe(401);
    });
  }
});
