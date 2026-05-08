import { describe, it, expect } from "vitest";
import { buildCqlQuery, parseSruResponse } from "./lexml";
import { NormKind } from "@prisma/client";

describe("LexML CQL builder", () => {
  it("usa fragmento URN-LEX para ORDINARY_LAW", () => {
    const q = buildCqlQuery({ kind: NormKind.ORDINARY_LAW });
    expect(q).toContain("urn:lex:br:federal:lei");
  });

  it("usa fragmento URN-LEX para CONSTITUTION", () => {
    const q = buildCqlQuery({ kind: NormKind.CONSTITUTION });
    expect(q).toContain("constituicao");
  });

  it("inclui freeText escapado quando fornecido", () => {
    const q = buildCqlQuery({ freeText: "Lei 8078 1990 (consumidor)" });
    expect(q).toContain("Lei 8078 1990");
    expect(q).not.toContain("(consumidor)"); // parênteses escapados
  });

  it("combina freeText + kind via AND", () => {
    const q = buildCqlQuery({ freeText: "Marco Civil", kind: NormKind.ORDINARY_LAW });
    expect(q).toContain("AND");
    expect(q).toContain("Marco Civil");
    expect(q).toContain("urn:lex:br:federal:lei");
  });
});

describe("parseSruResponse", () => {
  it("parseia XML SRU minimamente válido", () => {
    const xml = `<?xml version="1.0"?>
<searchRetrieveResponse>
  <numberOfRecords>2</numberOfRecords>
  <records>
    <record>
      <urn>urn:lex:br:federal:lei:1990-09-11;8078</urn>
      <title>Código de Defesa do Consumidor</title>
      <description>Dispõe sobre proteção do consumidor.</description>
      <date>1990-09-11</date>
    </record>
    <record>
      <urn>urn:lex:br:federal:lei:2002-01-10;10406</urn>
      <title>Código Civil</title>
    </record>
  </records>
</searchRetrieveResponse>`;
    const out = parseSruResponse(xml);
    expect(out.total).toBe(2);
    expect(out.records.length).toBe(2);
    expect(out.records[0]?.urn).toContain("8078");
    expect(out.records[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it("retorna 0 records em XML sem records", () => {
    const out = parseSruResponse("<root></root>");
    expect(out.records.length).toBe(0);
  });
});
