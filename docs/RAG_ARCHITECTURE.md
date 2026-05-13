# Lex — Arquitetura de RAG

Existem **dois motores** de recuperação no Lex. Eles convivem por
herança e têm responsabilidades distintas. Esta página documenta a
regra para evitar uso cruzado.

## Pesquisa jurídica no produto (P0 — 2026-05)

- O pipeline interno descrito abaixo (`retrieveLegalContext`, Qdrant, FTS, etc.) **permanece no repositório** e **não foi removido**.
- Para demo controlada e piloto (sign-off **F-1**), a **pesquisa jurídica voltada ao usuário** pode ser atendida pelo **modo assistido externo** documentado em `docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md` e implementado em `src/lib/legal-research/**` + `POST /api/legal-research/*`.
- **Estado do motor interno:** em **otimização / diagnóstico** — não é o caminho padrão da pesquisa assistida enquanto `LEGAL_RESEARCH_PROVIDER=deepseek` estiver vigente na configuração de ambiente alvo.
- **Compatibilidade:** existe `buildRetrievalSearchCompatiblePayload` (`src/lib/legal-research/retrieval-adapter.ts`) para montar o mesmo formato de resposta de `GET /api/retrieval/search` **sem editar** essa rota; integração na UI é responsabilidade da Lane E.

### Critérios sugeridos para voltar a usar o motor interno na pesquisa principal

1. **Benchmark** de precisão em gold-set (consultas + fundamentos esperados) acima do limiar definido com Legal.
2. **Validação humana** em amostra representativa de jurisprudência retornada (zero inventário de número de processo).
3. **Observabilidade:** taxa de erro, latência p95 e custo por consulta estáveis por duas semanas de staging.
4. Aprovação explícita no processo de release (owners não provisórios).

## TL;DR

| Caso de uso | Motor | Tabela primária | Collection Qdrant | Status |
|---|---|---|---|---|
| Pesquisa jurídica assistida (modo P0 externo) | `src/lib/legal-research` (DeepSeek API) | — | — | 🔶 temporário (F-1) |
| Pergunta sobre lei/jurisprudência (Strategy, Cases, retrieval explain) | `retrieveLegalContext` | `LegalNorm` + `LegalChunk` | `lex_corpus_norms`, `lex_corpus_jurisprudence` | ✅ canônico (motor interno intocado) |
| Pergunta sobre documento de processo do workspace (chat de processo, geração de peça) | `retrieveContext` (hybrid) | `Document` + `DocumentChunk` + `LegalPiece` | `lex_main` (multi-tenant) | ✅ válido |
| Busca global `/busca` | endpoint `/api/search/route.ts` (consome ambos com saneamento) | mix | mix | ✅ válido |
| `LegalSource` (legacy) | hybrid (com filtro anti-demo) | `LegalSource` | `lex_main` | ⚠️ legacy — **não** usar para novas features |

## Motor 1: `retrieveLegalContext` (`src/lib/retrieval/legal/`)

Usar **sempre** que a fonte da verdade for **lei, código, súmula, jurisprudência**.

- Pipeline: classify-intent → query rewriter → BM25 (Postgres FTS em
  `LegalChunk.textTsv`) **+** dense (Qdrant `lex_corpus_norms` /
  `lex_corpus_jurisprudence`) → RRF → graph expansion (citações entre
  normas) → cross-encoder rerank → boosts por intenção → grounding score.
- Multi-tenant: corpus oficial é **global** (`workspaceId="__global__"`,
  `tenantScope="global"`). Workspaces nunca contaminam o corpus.
- Filtros disponíveis: `kind`, `jurisdiction`, `tribunal`, `articleRef`,
  `asOf` (versão temporal), `tags`.
- Idempotente: mesma query deve produzir os mesmos chunks quando o corpus e índices estão estáveis (validar com `npm run retrieval:smoke` ou testes unitários dos estágios isolados).

**Quem chama**:
- `/api/strategy/analyze`
- `src/lib/cases/orchestrator.ts` (`draftWorkflow`, review)
- `/api/retrieval/explain`
- `/api/search` (para a aba "lei")

## Motor 2: `retrieveContext` (`src/lib/retrieval/hybrid-retriever.ts`)

Usar quando a fonte da verdade for **dado do workspace** (documentos do
processo, peças escritas pelo usuário, memória do processo).

- Pipeline: query expansion (LLM) → dense Qdrant (`lex_main`) → BM25
  Postgres ILIKE em `Process`/`DocumentChunk`/`LegalPiece` → RRF →
  cross-encoder rerank → merge com hot context.
- Multi-tenant: filtra `workspaceId` no Qdrant **e** nas queries SQL.
- `LegalSource` (legacy) entra como reforço, mas com filtro anti-DEMO/
  FIXTURE em produção.

**Quem chama**:
- `/api/chat/[threadId]` (chat de processo)
- `/api/completion`
- `/api/generate/piece`, `/api/pieces/generate`
- `/api/search` (para hits do workspace)

## Por que não unificar agora

A unificação requer:
1. Reescrever todos os call-sites do hybrid para o orchestrator.
2. Migrar `LegalSource` para `LegalNorm`/`LegalChunk` ou desligar.
3. Reescrever o chat de processo, que mistura corpus oficial + documentos
   do workspace (caso de uso natural do hybrid).

É uma feature, não uma estabilização. Hoje o que **deve estar garantido**:

- Strategy/Cases **não** podem retornar fonte demo/legacy. Já não
  retornam — usam orchestrator que olha apenas `LegalChunk`.
- Hybrid pode usar `LegalSource` como reforço, mas filtrando DEMO em
  produção (já feito).
- Busca global filtra DEMO/FIXTURE/STF-RE-DEMO.

## Tabelas-chave

| Tabela | Papel | Provider | Notas |
|---|---|---|---|
| `LegalNorm` | catálogo canônico de normas (URN) | `MANUAL`, `LEXML`, `STF`, `STJ`, `DATAJUD`, `CAMARA`, `SENADO`, `FIXTURE` | `sourceProvider` decide categoria |
| `LegalNormVersion` | versão temporal de uma norma | — | `validFrom/validTo` permite consulta `asOf` |
| `LegalChunk` | unidade de retrieval (artigo, parágrafo, inciso) | herda da norma | `textTsv` GENERATED ALWAYS AS tsvector |
| `LegalCitation` | grafo de citações entre normas | — | usado para graph expansion |
| `LegalSource` | tabela LEGADA — texto livre por código/artigo | sem `sourceProvider`, mistura demo + real | **NÃO** usar para corpus oficial novo |
| `Document` + `DocumentChunk` | uploads do workspace | — | indexado em `lex_main` |
| `LegalPiece` | peça redigida pelo usuário | — | indexada em `lex_main` |

## Collections Qdrant

| Collection | Conteúdo | Layer | Tenant |
|---|---|---|---|
| `lex_corpus_norms` | legislação (constituição, leis, decretos, códigos) | `legislation` | global |
| `lex_corpus_jurisprudence` | súmulas, jurisprudência, repetitivos | `jurisprudence` | global |
| `lex_main` | documentos do workspace (`Document`, `LegalPiece`, `LegalSource` legacy) | `user_documents` etc. | workspace |

A decisão de roteamento por chunk vive em
`src/lib/corpus/qdrant-collections.ts:collectionForKind(NormKind)`.

## Regras práticas para PRs

1. Nova feature jurídica (lei, jurisprudência) → `retrieveLegalContext`.
   Nunca acrescente leitura direta de `LegalSource`.
2. Novo chunk no `lex_main` precisa de `workspaceId` e `layer` no
   payload.
3. Nunca chame `deleteByDocumentId` sem `workspaceId` (interface não
   permite).
4. Se for adicionar uma collection nova: documente aqui antes de
   indexar.
5. Logs nunca devem imprimir o `chunkText` cru — pode conter PII de
   processo do cliente. Use `chunkId`/`normUrn`/`articleRef`.
