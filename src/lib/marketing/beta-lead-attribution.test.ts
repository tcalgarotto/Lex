import { describe, expect, it } from "vitest";
import {
  betaLeadAttributionSchema,
  normalizeAttributionForDb,
  readUtmFromSearchParams,
} from "@/lib/marketing/beta-lead-attribution";

describe("readUtmFromSearchParams", () => {
  it("lê parâmetros UTM da query", () => {
    const params = new URLSearchParams(
      "utm_source=linkedin&utm_medium=social&utm_campaign=investor_day&utm_content=hero&utm_term=lex",
    );
    expect(readUtmFromSearchParams(params)).toEqual({
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "investor_day",
      utmContent: "hero",
      utmTerm: "lex",
      referrer: "",
    });
  });
});

describe("normalizeAttributionForDb", () => {
  it("converte strings vazias em null", () => {
    expect(
      normalizeAttributionForDb({
        utmSource: "",
        utmMedium: "cpc",
        utmCampaign: "",
        utmContent: "",
        utmTerm: "",
        referrer: "",
      }),
    ).toEqual({
      utmSource: null,
      utmMedium: "cpc",
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      referrer: null,
    });
  });

  it("trunca referrer longo", () => {
    const long = "https://example.com/" + "a".repeat(3000);
    const out = normalizeAttributionForDb(
      { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "", referrer: "" },
      long,
    );
    expect(out.referrer?.length).toBe(2000);
  });
});

describe("betaLeadAttributionSchema", () => {
  it("aceita UTM opcionais", () => {
    const r = betaLeadAttributionSchema.safeParse({
      utmSource: "newsletter",
      utmMedium: "email",
    });
    expect(r.success).toBe(true);
  });
});
