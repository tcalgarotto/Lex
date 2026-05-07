import { describe, expect, it } from "vitest";
import {
  buildTitle,
  detectProcessNumber,
  detectTribunal,
  detectUf,
  extractDates,
  extractFacts,
  extractParties,
  extractRequests,
  runIntake,
  splitSentences,
} from "./intake";

describe("intake jurídico determinístico", () => {
  it("split de sentenças preserva 'Art.' e 'S/A'", () => {
    const t = "O Art. 5º da CF/88 garante direitos. A empresa Banco Itaú S/A negou o pedido.";
    const ss = splitSentences(t);
    expect(ss.length).toBe(2);
    expect(ss[0]).toContain("Art. 5º");
    expect(ss[1]).toContain("S/A");
  });

  it("extrai partes Autor: e Réu: com CPF/CNPJ", () => {
    const t = `Autor: João da Silva 123.456.789-00
Réu: Banco XYZ S/A 12.345.678/0001-99`;
    const parties = extractParties(t);
    const author = parties.find((p) => p.role === "AUTHOR");
    const def = parties.find((p) => p.role === "DEFENDANT");
    expect(author?.name).toContain("João da Silva");
    expect(author?.document).toBe("123.456.789-00");
    expect(author?.kind).toBe("PERSON");
    expect(def?.kind).toBe("COMPANY");
    expect(def?.document).toBe("12.345.678/0001-99");
  });

  it("identifica entidade pública pelo nome", () => {
    const t = "Réu: União Federal";
    const parties = extractParties(t);
    expect(parties[0]?.kind).toBe("PUBLIC_ENTITY");
    expect(parties.length).toBeGreaterThan(0);
  });

  it("extrai datas no formato dd/mm/aaaa e ISO", () => {
    expect(extractDates("celebrado em 12/03/2020")).toEqual(["2020-03-12"]);
    expect(extractDates("desde 2021-08-15")).toEqual(["2021-08-15"]);
  });

  it("extrai pedidos com verbos dispositivos", () => {
    const sentences = splitSentences(
      "Autor: João.\nRéu: Banco.\nO autor foi cliente desde 2018.\nRequer a condenação do réu ao pagamento de R$ 50.000,00 a título de danos morais.\nPugna pela tutela de urgência para suspender a cobrança.",
    );
    const reqs = extractRequests(sentences);
    expect(reqs.length).toBeGreaterThanOrEqual(2);
    expect(reqs.some((r) => r.kind === "URGENCY")).toBe(true);
    expect(reqs.some((r) => r.kind === "MAIN")).toBe(true);
  });

  it("não classifica pedidos como fatos", () => {
    const sentences = splitSentences(
      "O contrato foi firmado em 12/03/2020.\nRequer indenização por danos morais.",
    );
    const facts = extractFacts(sentences);
    expect(facts.length).toBe(1);
    expect(facts[0]?.text).toContain("contrato");
  });

  it("detecta tribunal, UF e número de processo", () => {
    const t = "Tribunal: TJSP\nUF: SP\nProcesso 0123456-78.2020.8.26.0001";
    expect(detectTribunal(t)).toBe("TJSP");
    expect(detectUf(t)).toBe("SP");
    expect(detectProcessNumber(t)).toBe("0123456-78.2020.8.26.0001");
  });

  it("buildTitle combina autor x réu + ação principal", () => {
    const parties = [
      { role: "AUTHOR" as const, kind: "PERSON" as const, name: "João da Silva" },
      { role: "DEFENDANT" as const, kind: "COMPANY" as const, name: "Banco XYZ S/A" },
    ];
    const requests = [
      { ordinal: 1, kind: "MAIN" as const, text: "Requer indenização por danos morais" },
    ];
    const title = buildTitle("texto longo qualquer", parties, requests);
    expect(title).toContain("João");
    expect(title).toContain("x");
    expect(title.toLowerCase()).toContain("indeniza");
  });

  it("runIntake ponta-a-ponta de relato realista", () => {
    const raw = `Autor: Maria Souza 111.222.333-44
Réu: Empresa ABC Ltda

A autora celebrou contrato de prestação de serviços com a ré em 12/03/2022. Em 05/05/2023 a ré deixou de prestar o serviço contratado, causando prejuízo material.

Requer a rescisão contratual e a condenação ao ressarcimento de R$ 12.500,00. Pleiteia tutela de urgência para imediata suspensão da cobrança.`;
    const r = runIntake(raw);
    expect(r.title.toLowerCase()).toContain("maria");
    expect(r.title.toLowerCase()).toContain("x");
    expect(r.parties.length).toBeGreaterThanOrEqual(2);
    expect(r.facts.length).toBeGreaterThanOrEqual(1);
    expect(r.requests.length).toBeGreaterThanOrEqual(2);
    expect(r.requests.some((req) => req.kind === "URGENCY")).toBe(true);
    expect(r.facts.some((f) => f.dates.length > 0)).toBe(true);
  });

  it("runIntake sem partes ainda devolve título e fatos", () => {
    const raw = "O cliente sofreu cobrança indevida em 03/04/2024 e foi negativado.";
    const r = runIntake(raw);
    expect(r.title.length).toBeGreaterThan(0);
    expect(r.facts.length).toBeGreaterThan(0);
  });
});
