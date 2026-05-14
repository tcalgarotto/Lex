import { afterEach, describe, expect, it, vi } from "vitest";
import { searchComunicaPjePublic, searchOfficialPublicationByCnj } from ".";

describe("official publications public connectors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries Comunica PJe by CNJ without auth headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 123,
              data_disponibilizacao: "2026-05-13",
              siglaTribunal: "TRF4",
              tipoComunicacao: "Intimação",
              numeroProcesso: "50006078320234036342",
              texto: "<p>Intimação pública</p>",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const results = await searchOfficialPublicationByCnj("5000607-83.2023.4.03.6342");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("numeroProcesso=50006078320234036342");
    expect(JSON.stringify(init)).not.toMatch(/authorization|cookie|senha|secret/i);
    expect(results[0]).toMatchObject({
      source: "DJEN",
      tribunalAcronym: "TRF4",
      processNumber: "50006078320234036342",
      externalId: "123",
    });
    expect(results[0]?.summary).toBe("Intimação pública");
  });

  it("does not perform broad empty searches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const results = await searchComunicaPjePublic({});
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
