import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/marketing/beta-lead/route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaLeadRequest: {
      create: vi.fn().mockResolvedValue({ id: "lead-1" }),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRequestIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitHeaders: vi.fn().mockReturnValue(new Headers()),
  rateLimitHttpStatus: vi.fn().mockReturnValue(429),
}));

vi.mock("@/lib/marketing/beta-lead-notify", () => ({
  notifyTeamOfBetaLead: vi.fn().mockResolvedValue(undefined),
}));

const validBody = {
  name: "Maria Silva",
  email: "maria@escritorio.com.br",
  company: "Silva Advocacia",
  role: "Sócia",
  teamSize: "2-5",
  mainPain: "Pesquisa lenta",
  intent: "beta",
  contactConsent: true,
  companyWebsite: "",
  utmSource: "linkedin",
  utmMedium: "social",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/marketing/beta-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/marketing/beta-lead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria lead com payload válido", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
  });

  it("rejeita sem consentimento", async () => {
    const res = await post({ ...validBody, contactConsent: false });
    expect(res.status).toBe(400);
  });

  it("aceita honeypot preenchido sem persistir (201 silencioso)", async () => {
    const { prisma } = await import("@/lib/prisma");
    const res = await post({ ...validBody, companyWebsite: "https://spam.bot" });
    expect(res.status).toBe(201);
    expect(prisma.betaLeadRequest.create).not.toHaveBeenCalled();
  });
});
