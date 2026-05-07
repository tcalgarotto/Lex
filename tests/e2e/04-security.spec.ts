import { test, expect } from "@playwright/test";

test.describe("security headers + origin guard", () => {
  test("/login tem CSP, X-Frame-Options DENY, Referrer-Policy", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("POST cross-origin para /api/auth/sync é bloqueado com 403", async ({ request }) => {
    const res = await request.post("/api/auth/sync", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.status()).toBe(403);
  });

  test("POST same-origin sem cookie -> 401 (auth required)", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const res = await request.post("/api/auth/sync", {
      headers: { Origin: origin },
    });
    expect(res.status()).toBe(401);
  });

  test("/api/inngest é exceção do origin guard (webhook)", async ({ request }) => {
    // inngest webhook precisa aceitar cross-origin (assinatura própria valida)
    const res = await request.post("/api/inngest", {
      headers: { Origin: "https://api.inngest.com" },
      data: {},
    });
    // pode ser 4xx por falta de assinatura, mas NUNCA 403 do CSRF guard
    expect(res.status()).not.toBe(403);
  });
});
