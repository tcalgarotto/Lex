import { describe, expect, it } from "vitest";
import { CasePartyKind, CasePartyRole, CaseRequestKind, CaseStatus } from "@prisma/client";
import { buildDraft } from "./drafting";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";

const fakeCase = {
  id: "c1",
  workspaceId: "w1",
  createdById: "u1",
  title: "Maria x Empresa ABC",
  summary: "Cobrança indevida com tutela de urgência.",
  rawInput: "...",
  status: CaseStatus.DRAFTING,
  tribunalCode: "TJSP",
  uf: "SP",
  processNumber: "0123456-78.2020.8.26.0001",
  metadataJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const facts = [
  {
    id: "f1",
    caseId: "c1",
    ordinal: 1,
    text: "Em 12/03/2022 a autora celebrou contrato de prestação com a ré.",
    category: "vinculo",
    dates: ["2022-03-12"],
    confidence: 0.8,
    createdAt: new Date(),
  },
  {
    id: "f2",
    caseId: "c1",
    ordinal: 2,
    text: "Em 05/05/2023 a ré deixou de prestar o serviço, causando prejuízo.",
    category: "dano",
    dates: ["2023-05-05"],
    confidence: 0.8,
    createdAt: new Date(),
  },
];

const parties = [
  {
    id: "p1",
    caseId: "c1",
    role: CasePartyRole.AUTHOR,
    kind: CasePartyKind.PERSON,
    name: "Maria Souza",
    document: "111.222.333-44",
    metadataJson: null,
    createdAt: new Date(),
  },
  {
    id: "p2",
    caseId: "c1",
    role: CasePartyRole.DEFENDANT,
    kind: CasePartyKind.COMPANY,
    name: "Empresa ABC Ltda",
    document: null,
    metadataJson: null,
    createdAt: new Date(),
  },
];

const requests = [
  {
    id: "r1",
    caseId: "c1",
    ordinal: 1,
    kind: CaseRequestKind.MAIN,
    text: "Requer condenação da ré ao pagamento de R$ 12.500,00.",
    legalBasisUrn: null,
    metadataJson: null,
    createdAt: new Date(),
  },
  {
    id: "r2",
    caseId: "c1",
    ordinal: 2,
    kind: CaseRequestKind.URGENCY,
    text: "Pugna pela tutela de urgência para suspender a cobrança.",
    legalBasisUrn: null,
    metadataJson: null,
    createdAt: new Date(),
  },
];

const chunk: LegalRetrievedChunk = {
  chunkId: "ch1",
  text: "Art. 422. Os contratantes são obrigados a guardar nos contratos a probidade e boa-fé.",
  fullPath: "Art. 422",
  structure: "ARTIGO" as never,
  articleRef: "Art. 422",
  norm: {
    id: "n1",
    urn: "urn:lex:br:federal:lei:2002-01-10;10406",
    kind: "LEI" as never,
    jurisdiction: "FEDERAL" as never,
    title: "Código Civil",
    identifier: "Lei nº 10.406/2002",
    tribunal: null,
    publishedAt: new Date("2002-01-10"),
  },
  versionId: "v1",
  validFrom: new Date("2003-01-11"),
  validTo: null,
  scores: { dense: 0.7, bm25: 0.6, rerank: 0.8, boost: 1.1, final: 0.85, breakdownJson: {} } as never,
  provenance: ["dense"],
  explanation: "stub",
};

const strategy: StrategySynthesis = {
  thesis: "Boa-fé objetiva impõe dever de cooperação contratual.",
  arguments: [
    {
      id: "arg-0",
      headline: "Fundamento central: Lei nº 10.406/2002 Art. 422",
      excerpt: "Os contratantes são obrigados a guardar nos contratos a probidade e boa-fé.",
      evidence: { chunkIds: ["ch1"], normUrns: ["urn:lex:br:federal:lei:2002-01-10;10406"] },
      weight: 0.85,
    },
  ],
  counterArguments: [
    { headline: "Versão histórica", detail: "Verifique vigência do dispositivo.", severity: "media" },
  ],
  nextSteps: ["Confirmar fatos do caso."],
  badge: "thesis · 1 arg · risk: media",
};

describe("buildDraft", () => {
  it("gera Markdown com seções estruturais", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk], strategy });
    expect(out.content).toContain("## I. Endereçamento");
    expect(out.content).toContain("## II. Qualificação das partes");
    expect(out.content).toContain("## III. Dos fatos");
    expect(out.content).toContain("## IV. Do direito");
    expect(out.content).toContain("## V. Dos pedidos");
    expect(out.content).toContain("## VI. Da tutela de urgência");
    expect(out.content).toContain("## VII. Das provas");
    expect(out.content).toContain("## VIII. Do valor da causa");
  });

  it("inclui partes com CPF/CNPJ quando presentes", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk] });
    expect(out.content).toContain("Maria Souza");
    expect(out.content).toContain("111.222.333-44");
    expect(out.content).toContain("Empresa ABC Ltda");
  });

  it("aponta tribunal pelo registry quando código existe", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk] });
    expect(out.content).toContain("Tribunal de Justiça");
    expect(out.content).toContain("0123456-78.2020.8.26.0001");
  });

  it("renderiza fatos numerados com referência temporal", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk] });
    expect(out.content).toContain("**01.**");
    expect(out.content).toContain("**02.**");
    expect(out.content).toContain("2022-03-12");
  });

  it("popula groundingChunkIds com chunks usados", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk], strategy });
    expect(out.groundingChunkIds).toContain("ch1");
  });

  it("inclui contra-argumentos com severidade quando há risks", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [chunk], strategy });
    expect(out.content).toContain("Riscos e contrapontos");
    expect(out.content).toContain("Versão histórica");
  });

  it("omite tutela de urgência quando não há pedido urgente", () => {
    const reqsNoUrg = requests.filter((r) => r.kind !== CaseRequestKind.URGENCY);
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests: reqsNoUrg, chunks: [chunk] });
    expect(out.content).not.toContain("VI. Da tutela de urgência");
  });

  it("usa fallback quando não há chunks recuperados", () => {
    const out = buildDraft({ case: fakeCase as never, facts, parties, requests, chunks: [] });
    expect(out.content).toContain("retrieval sem hits");
  });
});
