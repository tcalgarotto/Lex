import { describe, expect, it } from "vitest";
import { betaLeadBodySchema } from "@/lib/marketing/beta-lead";

const valid = {
  name: "Maria Silva",
  email: "maria@escritorio.com.br",
  company: "Silva Advocacia",
  role: "Sócia",
  teamSize: "2-5" as const,
  mainPain: "Pesquisa lenta",
  intent: "beta" as const,
  contactConsent: true,
  companyWebsite: "",
};

describe("betaLeadBodySchema", () => {
  it("aceita payload válido", () => {
    const r = betaLeadBodySchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejeita sem consentimento", () => {
    const r = betaLeadBodySchema.safeParse({ ...valid, contactConsent: false });
    expect(r.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const r = betaLeadBodySchema.safeParse({ ...valid, email: "nao-email" });
    expect(r.success).toBe(false);
  });

  it("aceita UTM e referrer opcionais", () => {
    const r = betaLeadBodySchema.safeParse({
      ...valid,
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "launch",
      referrer: "https://linkedin.com/feed",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita honeypot com URL longa no schema (campo livre curto)", () => {
    const r = betaLeadBodySchema.safeParse({
      ...valid,
      companyWebsite: "x".repeat(500),
    });
    expect(r.success).toBe(true);
  });
});

describe("BETA_LEAD_STATUS_LABEL", () => {
  it("mapeia status conhecidos", async () => {
    const { BETA_LEAD_STATUS_LABEL } = await import("@/lib/marketing/beta-lead");
    expect(BETA_LEAD_STATUS_LABEL["NEW"]).toBe("Novo");
    expect(BETA_LEAD_STATUS_LABEL["QUALIFIED"]).toBe("Qualificado");
  });
});
