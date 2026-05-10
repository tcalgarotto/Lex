import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeDeepSeekJsonContent } from "@/lib/legal-research/normalize-deepseek-result";
import { DeepSeekLegalResearchProvider } from "@/lib/legal-research/deepseek-provider";

const baseReq = {
  workspaceId: "ws_test",
  query: "responsabilidade civil danos morais",
  resultTypes: ["LAW", "JURISPRUDENCE"] as const,
  maxResults: 4,
  language: "pt-BR" as const,
};

describe("normalizeDeepSeekJsonContent", () => {
  it("parses valid JSON payload", () => {
    const raw = JSON.stringify({
      summary: "Resumo",
      legalFoundations: [
        {
          id: "f1",
          title: "CDC",
          citation: "Lei 8.078/90",
          excerpt: "Trecho",
          legalIssue: "Consumidor",
          whyRelevant: "x",
          suggestedUse: "y",
          confidence: 0.8,
        },
      ],
      jurisprudenceCandidates: [],
    });
    const out = normalizeDeepSeekJsonContent(raw, { provider: "test" });
    expect(out.summary).toBe("Resumo");
    expect(out.legalFoundations.length).toBe(1);
    expect(out.legalFoundations[0]?.id).toBeDefined();
  });

  it("handles invalid JSON string", () => {
    const out = normalizeDeepSeekJsonContent("not json {", { provider: "test" });
    expect(out.summary.toLowerCase()).toContain("json");
    expect(out.providerMetadata["parseError"]).toBeDefined();
  });

  it("handles JSON that is not an object", () => {
    const out = normalizeDeepSeekJsonContent('"hello"', { provider: "test" });
    expect(out.legalFoundations).toEqual([]);
  });
});

describe("DeepSeekLegalResearchProvider", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...origEnv };
  });

  it("returns structured error response when API key is missing (no throw)", async () => {
    delete process.env["DEEPSEEK_API_KEY"];
    process.env["DEEPSEEK_MODEL"] = "deepseek-chat";
    process.env["DEEPSEEK_LEGAL_RESEARCH_ENABLED"] = "1";
    const provider = new DeepSeekLegalResearchProvider();
    const out = await provider.search({
      ...baseReq,
      resultTypes: ["LAW"],
    });
    expect(out.summary.toLowerCase()).toContain("falha");
    expect(out.providerMetadata["upstreamError"]).toBeDefined();
  });

  it("uses fallback-friendly response on upstream failure", async () => {
    process.env["DEEPSEEK_API_KEY"] = "test-key";
    process.env["DEEPSEEK_MODEL"] = "deepseek-chat";
    process.env["DEEPSEEK_LEGAL_RESEARCH_ENABLED"] = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "err",
        json: async () => ({ error: { message: "upstream" } }),
      }),
    );
    const provider = new DeepSeekLegalResearchProvider();
    const out = await provider.search({ ...baseReq, resultTypes: ["LAW"] });
    expect(out.riskFlags.length).toBeGreaterThan(0);
    expect(out.providerMetadata["upstreamError"]).toBeDefined();
  });

  it("applies rate-limit retry path without throwing when second attempt succeeds", async () => {
    process.env["DEEPSEEK_API_KEY"] = "test-key";
    process.env["DEEPSEEK_MODEL"] = "deepseek-chat";
    process.env["DEEPSEEK_LEGAL_RESEARCH_ENABLED"] = "1";
    const okJson = {
      choices: [{ message: { content: JSON.stringify({ summary: "ok", legalFoundations: [] }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "fail",
        json: async () => ({}),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => okJson,
      });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DeepSeekLegalResearchProvider();
    const out = await provider.search({ ...baseReq, resultTypes: ["LAW"] });
    expect(out.summary).toBe("ok");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
