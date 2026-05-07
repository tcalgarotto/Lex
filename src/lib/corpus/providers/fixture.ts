/**
 * Provider de fixture/in-memory. Não faz I/O. Útil para:
 *   - Testes de integração do repository sem depender de LexML real.
 *   - Bootstrap rápido de demo (Lex demo dataset).
 *
 * As fixtures abaixo são pequenas mas cobrem a hierarquia que importa:
 * Lei (CDC), Lei Complementar, Constituição (preâmbulo), Decreto, Súmula.
 */

import { CorpusProvider, NormKind } from "@prisma/client";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

const FIXTURE_NORMS: ReadonlyArray<{
  candidate: CorpusCandidate;
  rawText: string;
}> = [
  {
    candidate: {
      urn: "urn:lex:br:federal:lei:1990-09-11;8078",
      kind: NormKind.ORDINARY_LAW,
      title: "Código de Defesa do Consumidor",
      identifier: "Lei nº 8.078/1990",
      authority: "Presidência da República",
      ementa:
        "Dispõe sobre a proteção do consumidor e dá outras providências.",
      publishedAt: new Date("1990-09-11T00:00:00Z"),
      effectiveAt: new Date("1991-03-11T00:00:00Z"),
      language: "pt-BR",
      tags: ["consumidor", "direito do consumidor"],
      sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
      sourceExternalId: "lei-8078-1990",
    },
    rawText: `LEI Nº 8.078, DE 11 DE SETEMBRO DE 1990.

Dispõe sobre a proteção do consumidor e dá outras providências.

TÍTULO I
DOS DIREITOS DO CONSUMIDOR

CAPÍTULO I
DISPOSIÇÕES GERAIS

Art. 1º O presente código estabelece normas de proteção e defesa do consumidor, de ordem pública e interesse social, nos termos dos arts. 5º, XXXII, 170, V, da Constituição Federal e art. 48 de suas Disposições Transitórias.

Art. 2º Consumidor é toda pessoa física ou jurídica que adquire ou utiliza produto ou serviço como destinatário final.
Parágrafo único. Equipara-se a consumidor a coletividade de pessoas que haja intervindo nas relações de consumo.

Art. 6º São direitos básicos do consumidor:
I — a proteção da vida, saúde e segurança contra os riscos provocados por práticas no fornecimento de produtos e serviços considerados perigosos ou nocivos;
II — a educação e divulgação sobre o consumo adequado dos produtos e serviços;
III — a informação adequada e clara sobre os diferentes produtos e serviços, com especificação correta de quantidade, características, composição, qualidade e preço.`,
  },
  {
    candidate: {
      urn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
      kind: NormKind.CONSTITUTION,
      title: "Constituição da República Federativa do Brasil de 1988",
      identifier: "CF/1988",
      authority: "Assembleia Nacional Constituinte",
      publishedAt: new Date("1988-10-05T00:00:00Z"),
      effectiveAt: new Date("1988-10-05T00:00:00Z"),
      language: "pt-BR",
      tags: ["constituicao", "direitos fundamentais"],
      sourceUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      sourceExternalId: "cf-1988",
    },
    rawText: `CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988

PREÂMBULO

Nós, representantes do povo brasileiro, reunidos em Assembleia Nacional Constituinte para instituir um Estado Democrático, destinado a assegurar o exercício dos direitos sociais e individuais, a liberdade, a segurança, o bem-estar, o desenvolvimento, a igualdade e a justiça como valores supremos de uma sociedade fraterna, pluralista e sem preconceitos, fundada na harmonia social.

TÍTULO II
DOS DIREITOS E GARANTIAS FUNDAMENTAIS

CAPÍTULO I
DOS DIREITOS E DEVERES INDIVIDUAIS E COLETIVOS

Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade.
§ 1º As normas definidoras dos direitos e garantias fundamentais têm aplicação imediata.
§ 2º Os direitos e garantias expressos nesta Constituição não excluem outros decorrentes do regime e dos princípios por ela adotados.`,
  },
  {
    candidate: {
      urn: "urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14",
      kind: NormKind.SUMULA_VINCULANTE,
      title: "Súmula Vinculante 14",
      identifier: "Súmula Vinculante 14",
      authority: "Supremo Tribunal Federal",
      tribunal: "STF",
      publishedAt: new Date("2009-02-09T00:00:00Z"),
      effectiveAt: new Date("2009-02-09T00:00:00Z"),
      language: "pt-BR",
      tags: ["sumula vinculante", "stf", "ampla defesa"],
      sourceUrl: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=1230",
      sourceExternalId: "sv-14",
    },
    rawText: `SÚMULA VINCULANTE 14

É direito do defensor, no interesse do representado, ter acesso amplo aos elementos de prova que, já documentados em procedimento investigatório realizado por órgão com competência de polícia judiciária, digam respeito ao exercício do direito de defesa.`,
  },
];

export class FixtureCorpusProvider implements CorpusProviderClient {
  readonly id = CorpusProvider.FIXTURE;

  async list(filters: ListFilters): Promise<ListPage> {
    const cursor = filters.cursor ?? null;
    const pageSize = filters.pageSize ?? 100;

    const filtered = filters.kind
      ? FIXTURE_NORMS.filter((n) => n.candidate.kind === filters.kind)
      : FIXTURE_NORMS;

    const startIdx = cursor ? Math.max(0, parseInt(cursor, 10)) : 0;
    if (Number.isNaN(startIdx)) {
      throw new Error(`fixture: cursor inválido "${cursor}"`);
    }
    const slice = filtered.slice(startIdx, startIdx + pageSize);
    const nextStart = startIdx + slice.length;
    const nextCursor = nextStart < filtered.length ? String(nextStart) : null;
    return {
      candidates: slice.map((n) => n.candidate),
      nextCursor,
      totalEstimated: filtered.length,
    };
  }

  async fetch(candidate: CorpusCandidate): Promise<CorpusPayload> {
    const found = FIXTURE_NORMS.find((n) => n.candidate.urn === candidate.urn);
    if (!found) throw new Error(`fixture: norma não encontrada ${candidate.urn}`);
    return {
      candidate: found.candidate,
      rawText: found.rawText,
      metadata: { source: "fixture" },
    };
  }
}

export function fixtureProvider(): CorpusProviderClient {
  return new FixtureCorpusProvider();
}

/** Acesso direto pra testes que precisam asserts sobre a fixture. */
export function getFixtureNorms(): ReadonlyArray<{
  candidate: CorpusCandidate;
  rawText: string;
}> {
  return FIXTURE_NORMS;
}
