/**
 * Stubs dos providers Câmara dos Deputados e Senado Federal (Dados Abertos).
 *
 * Status: **stub seguro**. Mantemos estrutura para implementação futura sem
 * forçar dependência hoje. Em produção, o registry os apresenta como
 * `disabled` por padrão (vide `src/lib/corpus/providers/registry.ts`).
 *
 * Endpoints oficiais:
 *  - Câmara: https://dadosabertos.camara.leg.br/api/v2
 *  - Senado: https://legis.senado.leg.br/dadosabertos
 *
 * Ambos NÃO exigem chave para endpoints públicos (proposições, tramitação,
 * deputados/senadores, normas/metadados). Quando ativarmos:
 *  - prioridade: matérias em tramitação para alertar mudança legislativa
 *  - alimentação: `LegalNorm.kind = OTHER` com payload em `metadataJson`
 *  - relacionamento: `LegalCitation` para vincular projeto de lei → norma
 *    sancionada quando virar lei.
 */

import { CorpusProvider } from "@prisma/client";
import type {
  CorpusCandidate,
  CorpusPayload,
  CorpusProviderClient,
  ListFilters,
  ListPage,
} from "./types";

class NotImplementedProvider implements CorpusProviderClient {
  constructor(readonly id: CorpusProvider, private readonly label: string) {}
  async list(_filters: ListFilters): Promise<ListPage> {
    void _filters;
    throw new Error(
      `Provider ${this.label} ainda não está implementado. Veja src/lib/corpus/providers/legislative-stubs.ts.`,
    );
  }
  async fetch(_candidate: CorpusCandidate): Promise<CorpusPayload> {
    void _candidate;
    throw new Error(
      `Provider ${this.label} ainda não está implementado. Veja src/lib/corpus/providers/legislative-stubs.ts.`,
    );
  }
}

/** Documenta os endpoints planejados sem fazer fetch. */
export const CAMARA_PLANNED_ENDPOINTS = {
  proposicoes: "/proposicoes",
  proposicoesAutores: "/proposicoes/{id}/autores",
  proposicoesTramitacoes: "/proposicoes/{id}/tramitacoes",
  proposicoesTemas: "/proposicoes/{id}/temas",
  proposicoesVotacoes: "/proposicoes/{id}/votacoes",
} as const;

export const SENADO_PLANNED_ENDPOINTS = {
  materiasPesquisa: "/materia/pesquisa/lista",
  materiaDetalhe: "/materia/{codigo}",
  materiaTramitacao: "/materia/movimentacoes/{codigo}",
  materiaVotacao: "/materia/votacoes/{codigo}",
} as const;

export function camaraProviderStub(): CorpusProviderClient {
  // PLANALTO é um placeholder no enum atual; usamos para representar Câmara
  // até criarmos um valor dedicado no schema.
  return new NotImplementedProvider(CorpusProvider.PLANALTO, "Câmara dos Deputados (Dados Abertos)");
}

export function senadoProviderStub(): CorpusProviderClient {
  return new NotImplementedProvider(CorpusProvider.MANUAL, "Senado Federal (Dados Abertos)");
}
