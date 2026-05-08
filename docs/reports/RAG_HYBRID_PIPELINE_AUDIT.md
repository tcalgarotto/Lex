# RAG Hybrid Pipeline — Auditoria de estado (FASE 0)

**Data:** 2026-05-08
**Escopo:** auditar o pipeline de retrieval jurídico já em produção sobre o corpus
da Constituição Federal (514 chunks/514 pontos) **antes** de qualquer mudança.
Sem alterações de código nesta fase.

Referência prévia: [`docs/reports/RAG_CONSTITUICAO_IMPORT.md`](RAG_CONSTITUICAO_IMPORT.md).

---

## 1. Como `lex_corpus_norms` foi criada

`ensureCorpusCollections` em
[`src/lib/corpus/qdrant-collections.ts`](../../src/lib/corpus/qdrant-collections.ts)
cria a collection assim:

```ts
await client.createCollection(collection, {
  vectors: { size: CORPUS_VECTOR_SIZE, distance: CORPUS_DISTANCE },
});
```

Ou seja: **vetor único e sem nome** (`unnamed`) — `size=1024`, `distance=Cosine`.
Nenhum `sparse_vectors` configurado.

Indexes criados após o `createCollection` (lista atual em `COMMON_INDEXES`):
`tenantScope`, `workspaceId`, `normUrn`, `normId`, `normVersionId`, `kind`,
`jurisdiction`, `tribunal`, `structure`, `articleRef`, `paragraphRef`,
`incisoRef`, `alineaRef`, `publishedAtTs`, `validFromTs`, `contentHash`, `tags`,
`text` (text index), `codigo`, `tipo`, `tema`, `sourceProvider`, `status`.

Faltam, conforme briefing FASE 2:
- `layer` (keyword)
- `workspaceId` precisa de `is_tenant: true` (hoje é keyword simples)
- `textPreview` (text) — não existe ainda no payload

## 2. Named vector vs vetor único

Hoje: **vetor único sem nome**. Para hybrid search com `prefetch + fusion=rrf`
do Qdrant Query API, precisamos migrar para o schema:

```ts
vectors: { dense: { size: 1024, distance: "Cosine" } },
sparse_vectors: { keywords: {} }
```

Qdrant **não permite** mutar `vectors`/`sparse_vectors` em collection
existente — isso obriga a migration controlada (FASE 4 do plano).

## 3. Dimensão real dos embeddings

`CORPUS_VECTOR_SIZE = 1024` em
[`src/lib/corpus/qdrant-collections.ts`](../../src/lib/corpus/qdrant-collections.ts).
Confirmado no relatório anterior (514/514 embeddings com 1024 dim).

Provider: `embedTexts` em `src/lib/ai/embeddings.ts` usa BGE-M3 (DeepInfra)
com 1024 dim — coerente.

## 4. Sparse vector configurado?

**Não.** Nenhuma referência a `sparse_vectors`/`namedSparseVector`/
`buildSparseVector` no diretório `src/lib/`:

```
$ rg -l "sparse_vectors|namedSparseVector|buildSparseVector" src/
(sem resultados)
```

Existe `searchBm25` em
[`src/lib/retrieval/legal/bm25.ts`](../../src/lib/retrieval/legal/bm25.ts)
mas é Postgres FTS via `tsvector @@ websearch_to_tsquery`, **não** sparse
vector no Qdrant.

## 5. Payload indexes existentes vs requeridos pelo briefing

| Briefing | Status atual | Ação |
| --- | --- | --- |
| `workspaceId` keyword + `is_tenant=true` | keyword sem flag tenant | Migrar com `is_tenant: true` |
| `layer` keyword | **AUSENTE** (campo não existe no payload) | Adicionar campo + index |
| `codigo` keyword | ✅ presente | OK |
| `tipo` keyword | ✅ presente | OK |
| `status` keyword | ✅ presente | OK |
| `articleRef` keyword | ✅ presente | OK |
| `paragraphRef` keyword | ✅ presente | OK |
| `incisoRef` keyword | ✅ presente | OK |
| `alineaRef` keyword | ✅ presente | OK |
| `tema` keyword | ✅ presente | OK |
| `sourceProvider` keyword | ✅ presente | OK |
| `contentHash` keyword | ✅ presente | OK |
| `normUrn` keyword | ✅ presente | OK |
| `normId` keyword | ✅ presente | OK |
| `normVersionId` keyword | ✅ presente | OK |
| `text` (text index) | ✅ presente como `text` | Sugerido renomear para `textPreview` (mais leve) |

**Gap de migration**: tenant index (`is_tenant: true`) e `layer`.

## 6. `workspaceId` / `layer` no payload

`embedAndUpsertNormVersion` em
[`src/lib/corpus/embeddings-pipeline.ts`](../../src/lib/corpus/embeddings-pipeline.ts)
escreve no payload:

```ts
tenantScope: "global",
workspaceId: GLOBAL_TENANT_WORKSPACE,  // = "__global__"
```

Onde `GLOBAL_TENANT_WORKSPACE = "__global__"` (dois underscores). O briefing
pede `_global_` (1 underscore) e adiciona `layer="legal_corpus"`.

**Decisão registrada no plano**: criar `LEGAL_CORPUS_TENANT_ID = "_global_"` em
`src/lib/constants.ts` para `lex_corpus_norms`. `__global__` continua sendo
usado em `lex_main` (collection separada) sem regressão.

`layer` **não está no payload nem no `CorpusVectorPayload`**. Adicionar.

## 7. `retrieveLegalContext` usa Qdrant dense + Postgres FTS?

**Sim, em paralelo + RRF in-code.** Em
[`src/lib/retrieval/legal/index.ts`](../../src/lib/retrieval/legal/index.ts):

- `searchDense` (Qdrant `client.search` em `lex_corpus_norms` +
  `lex_corpus_jurisprudence`) — estágio `dense`.
- `searchBm25` (Postgres FTS `ts_rank_cd`) — estágio `bm25`.
- `fuseCandidates` ([`src/lib/retrieval/legal/hybrid.ts`](../../src/lib/retrieval/legal/hybrid.ts))
  faz RRF in-code sobre as duas listas.
- Não usa Qdrant `prefetch + fusion: "rrf"` — fusão é manual.

**Hybrid Qdrant nativo a fazer:** `searchHybridQdrant` que usa Query API com
`prefetch` dense + sparse + `query: { fusion: "rrf" }` no servidor.

## 8. ILIKE em corpus jurídico

```
$ rg -l "ILIKE|ilike" src/lib/retrieval
src/lib/retrieval/hybrid-retriever.ts
```

Inspecionando
[`src/lib/retrieval/hybrid-retriever.ts`](../../src/lib/retrieval/hybrid-retriever.ts)
linhas 99-124, os ILIKE atingem apenas:

- `Process` (workspace)
- `DocumentChunk`/`Document` (uploads de usuário)
- `LegalPiece` (peças geradas pelo workspace)

Esse engine `retrieveContext` é **explicitamente** marcado (linhas 126-129) como
sendo só para dados de workspace, e é separado do retrieval jurídico canônico
(`retrieveLegalContext`). Nenhum `ILIKE` toca `LegalNorm`/`LegalChunk`.

**Confirmado:** corpus jurídico está livre de ILIKE. BM25 jurídico usa FTS.

## 9. Redis cache ativo?

Sim:
- Cliente singleton em [`src/lib/redis.ts`](../../src/lib/redis.ts) com lazy
  connect, fail-fast, fallback silencioso.
- Cache de retrieval em
  [`src/lib/retrieval/legal/cache.ts`](../../src/lib/retrieval/legal/cache.ts)
  com Redis primary + LRU fallback (`MemoryLRU(256)`).
- Chave atual: `sha256(query + filters + options)` — **não inclui
  `corpusContentHash`** (gap a corrigir na FASE 9).
- TTL default 5 min (`DEFAULT_TTL_SEC = 300`).

## 10. `lex_main` isolado de legislação oficial?

Sim. Quem escreve em `lex_main`:

- [`src/lib/retrieval/vector-store/qdrant-store.ts`](../../src/lib/retrieval/vector-store/qdrant-store.ts) —
  `QdrantVectorStore` com `collection() = env.QDRANT_COLLECTION` (default
  `lex_main`). Usado para chunks de `Document` (uploads dos usuários).

Quem escreve em `lex_corpus_norms`/`lex_corpus_jurisprudence`:

- [`src/lib/corpus/embeddings-pipeline.ts`](../../src/lib/corpus/embeddings-pipeline.ts) —
  via `collectionForKind(kind)` que mapeia explicitamente `JURISPRUDENCE_*`
  para `lex_corpus_jurisprudence` e o resto para `lex_corpus_norms`. Nenhum
  branch escreve em `lex_main`.

Quem lê:

- `searchDense` em
  [`src/lib/retrieval/legal/dense.ts`](../../src/lib/retrieval/legal/dense.ts)
  consulta apenas `Object.values(CORPUS_COLLECTIONS)` =
  `[lex_corpus_norms, lex_corpus_jurisprudence]`.

**Isolamento confirmado**: legislação oficial vive separada dos uploads.

## 11. `qa:search` mede latência?

Hoje **não.** Inspecionando
[`scripts/cf-retrieval-briefing.ts`](../../scripts/cf-retrieval-briefing.ts):

- Roda `retrieveLegalContext` por query.
- Reporta `pass/fail` baseado em `articleRef` esperado vs top-3.
- **Não** mede cold/warm latency.
- **Não** quebra timing por estágio (dense/bm25/rerank).
- A própria `LegalRetrievalTrace` carrega `totalLatencyMs` e `stages[].latencyMs`,
  mas o script só imprime o veredito.

**Gap a corrigir na FASE 11:** medir cold + warm latency, imprimir breakdown
do trace (dense_ms, bm25_ms, fusion_ms, rerank_ms, cache hit/miss).

## 12. Resumo dos gaps a fechar

| # | Gap | Fase do plano |
| - | --- | --- |
| 1 | Collection `lex_corpus_norms` em vetor único — sem named vectors nem sparse | FASE 3 + FASE 4 (migration) |
| 2 | Sem módulo `sparse.ts` jurídico (vocabulário forte + hashing estável) | FASE 1 |
| 3 | `workspaceId` sem `is_tenant: true` | FASE 5 (ensure-indexes) |
| 4 | Campo `layer` ausente no payload e nos indexes | FASE 2 + FASE 4 |
| 5 | Tenant id `__global__` em vez de `_global_` (briefing literal) | FASE 2 |
| 6 | Sem `searchHybridQdrant` (Query API nativa com fusion=rrf) | FASE 7 |
| 7 | `buildQdrantFilter` em `dense.ts` não injeta tenant/layer/status | FASE 8 |
| 8 | Cache key sem `corpusContentHash`, sem timing breakdown no trace | FASE 9 |
| 9 | `qa:search` não mede cold/warm latency, nem breakdown | FASE 11 |
| 10 | ColBERT: sem doc, sem flag `LEGAL_COLBERT_ENABLED` | FASE 10 |

## 13. Estado das collections (snapshot — `npm run qdrant:stats`)

> A última execução documentada em
> [`docs/reports/RAG_CONSTITUICAO_IMPORT.md`](RAG_CONSTITUICAO_IMPORT.md) §5
> registra:
>
> - `lex_main` — 428 pontos (uploads de usuários, intocada)
> - `lex_corpus_norms` — **514 pontos**, dense unnamed, status `green`
> - `lex_corpus_jurisprudence` — 0 pontos (vazio até primeira ingest de súmulas)

Esta auditoria confirma a ausência de mudanças desde aquele snapshot — não foi
executado novo seed/import nesta fase.

## 14. Risco identificado para a migration (FASE 4)

A Qdrant API **não permite** drop de collection com índices em uso por queries
ativas sem retomada. A janela é curta (alguns segundos). Mitigações:

- Snapshot do `scroll` é dump local em JSONL — qualquer falha permite re-upsert
  do snapshot antes de tocar produção.
- O plano já contempla `--dry-run` no script `qdrant-migrate-hybrid.ts` para
  validar a etapa de scroll/contagem antes do drop.
- Re-upsert preserva os mesmos `point.id` para que `LegalChunk.vectorPointId`
  continue válido sem migrate Postgres.

---

**Conclusão da FASE 0:**
O corpus está consistente (514/514 chunks/pontos), retrieval híbrido in-code
funciona, FTS robusto, cache Redis+LRU operacional. Os 10 gaps acima são
aditivos — nenhum exige reset/reimport da CF. Próxima fase: criar
`src/lib/retrieval/legal/sparse.ts`.
