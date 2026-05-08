# RAG Hybrid Search Upgrade — Relatório final (FASE 14)

**Data:** 2026-05-08
**Autor:** Lex Engineering (Principal Engineer / Retrieval)
**Escopo:** Evolução do retrieval jurídico nacional para hybrid search real
(dense + sparse), payload indexes avançados, multitenancy correta, cache com
invalidação por hash de corpus, breakdown de latência e QA jurídico ampliado.

Referências:
- Estado anterior: [`RAG_CONSTITUICAO_IMPORT.md`](RAG_CONSTITUICAO_IMPORT.md)
- Auditoria FASE 0: [`RAG_HYBRID_PIPELINE_AUDIT.md`](RAG_HYBRID_PIPELINE_AUDIT.md)
- Design ColBERT (opcional): [`../COLBERT_LEGAL_RETRIEVAL.md`](../COLBERT_LEGAL_RETRIEVAL.md)

---

## 1. O que mudou (resumo executivo)

| Eixo | Antes | Depois |
|---|---|---|
| Vetores em `lex_corpus_*` | 1 vetor único sem nome (1024D, Cosine) | **named dense** `dense` (1024D, Cosine) + **sparse** `keywords` |
| Sparse retrieval | inexistente | `buildLegalSparseVector` (TF + boosts) com hashing estável FNV-1a |
| Hybrid fusion | dense + FTS via RRF in-code | **Qdrant Query API** com `prefetch` + `fusion=rrf` (nativo) com fallback in-code |
| Payload indexes | parcial, sem `is_tenant` | completo + `workspaceId` com `is_tenant=true` (multitenancy nativa) |
| Tenancy do corpus oficial | `workspaceId="__global__"` (compartilhado com docs do user) | `workspaceId="_global_"` + `layer="legal_corpus"` (com fallback p/ legado) |
| Cache | TTL fixo, sem invalidação por corpus | chave inclui `corpusContentHash` (60s) + breakdown `cache.backend` |
| Trace de latência | `latencyMs` total | `timings.{denseMs, sparseMs, ftsMs, fusionMs}` + `cache.hit/backend` |
| QA jurídico | 10 queries, latência total | **15 queries** cold/warm com breakdown por estágio |
| ColBERT/multivectors | inexistente | feature flag `LEGAL_COLBERT_ENABLED=false` + design doc |

**Critério final:** todos os checks passam (lint, typecheck, test, build,
`qa:search:legal` 15/15) sem reset/reimport do corpus.

---

## 2. FASE 0 — Auditoria

Relatório separado em [`RAG_HYBRID_PIPELINE_AUDIT.md`](RAG_HYBRID_PIPELINE_AUDIT.md).
Principais constatações:

- `lex_corpus_norms` criada com **vetor único sem nome** (1024D Cosine), **sem
  `sparse_vectors`** → Hybrid Search real impossível sem migrar schema.
- `workspaceId` indexado mas **sem `is_tenant=true`**, e os pontos do corpus oficial
  estavam usando `__global__` (mesma tag de uploads anônimos) — multi-tenancy
  fraca.
- `retrieveLegalContext` rodava dense (Qdrant) + Postgres FTS → RRF in-code.
  **Sem sparse** e **sem Query API nativa**.
- Cache Redis ativo mas chave **não considerava `LegalNormVersion.contentHash`**
  → atualização do corpus não invalidava cache.
- `qa:search` reportava só latência total, sem decomposição.

---

## 3. FASE 1 — Sparse representation

`src/lib/retrieval/legal/sparse.ts` (novo + tests).

**Hashing estável:** FNV-1a 32-bit determinístico (sem dependência externa,
sem ICU). Documentado risco de colisão (~ p≈3.5e-9 p/ 100 termos no
universo 2³² — desprezível para boosts heurísticos).

**Tokenização jurídica:**
- Strip de acentos e lower (NFD).
- Substituições semânticas estáveis: `art. 5º` → `art_5`, `§ 3º` → `paragrafo_3`,
  `inciso LV` → `inciso_lv`, `219-A` → `219a`.
- Stop-words PT-BR + jurídicas (`do`, `da`, `art`, `caput`, …) removidas após
  reconhecer os n-grams.
- Suffixes alfanuméricos de artigo preservados (`art_219a`).

**`buildLegalSparseVector(chunk, payload)`:** TF logarítmico + boosts:
- `articleRef` → 4×, `paragraphRef`/`incisoRef` → 2.5×.
- `kind` (CONSTITUTION, LAW, JURISPRUDENCE…) → 1.8×.
- `tema`/`materia` → 1.5×.
- `codigo` (`cf88`, `cpc`, `cdc`…) → 1.7×.

**`buildLegalSparseQuery(query, intent)`:** termos da query com base 1.0 +
boosts a partir do `LegalIntent` (URNs, articleRefs, tribunals).

**Testes** (`sparse.test.ts`): determinismo do hash, tokenização correta de
n-grams jurídicos, manutenção de dígitos isolados (`art 5`, `inciso 5`),
preservação de suffixes alfanuméricos (`art. 219-A`).

---

## 4. FASE 2 — Multi-tenancy correta

`src/lib/constants.ts`:

```ts
export const LEGAL_CORPUS_TENANT_ID = "_global_";   // corpus oficial (CF, leis, jurisprudência)
export const CORPUS_LAYER_LEGAL = "legal_corpus";    // separa do upload do user
export const CORPUS_LAYER_WORKSPACE_DOC = "workspace_document";
// GLOBAL_WORKSPACE_ID="__global__" preservado para uploads compartilhados
```

`CorpusVectorPayload` ganhou: `layer`, `textPreview` (~200 chars indexáveis),
`tokensEstimate`, `isDocumentNote`, `validFromIso`, `validToIso`.

**`COMMON_INDEXES`** atualizado com `workspaceId { is_tenant: true }` (Qdrant
multitenancy nativa) + novos campos `layer` (keyword) e `textPreview` (text
index).

**Compatibilidade legado:** o filtro de busca aceita pontos com tanto
`workspaceId="_global_"` (novos) quanto `workspaceId="__global__"` (anteriores
à migração) e **não exige** `layer` no filtro — pontos legados sem `layer`
continuam encontráveis. Implementação em `qdrant-corpus-filter.ts`:

```ts
// must:
[
  { key: "workspaceId", match: { any: ["_global_", "__global__"] } },
  { key: "status", match: { value: "ACTIVE" } },
  ...userFilters,
]
```

---

## 5. FASE 3 — Schema da collection

`ensureCorpusCollections` agora cria collections **híbridas** desde o `create`:

```ts
{
  vectors: {
    [DENSE_VECTOR_NAME /* "dense" */]: { size: 1024, distance: "Cosine" }
  },
  sparse_vectors: {
    [SPARSE_VECTOR_NAME /* "keywords" */]: {}
  }
}
```

Idempotente: se a collection já existe, apenas garante os indexes (script
`qdrant:ensure-indexes`).

---

## 6. FASES 4–6 — Migração e reindex

Três scripts npm dedicados, **idempotentes** e com `--dry-run` quando
relevante.

### `scripts/qdrant-migrate-hybrid.ts` → `npm run qdrant:migrate-hybrid[:dry]`

Migra `lex_corpus_norms` e `lex_corpus_jurisprudence` do schema legado
(unnamed dense) para hybrid (named dense + sparse):

1. **Scroll** todos os pontos preservando `id`, `payload` e o **dense vector
   original** (sem reembedar — economia de custo).
2. **Snapshot local** em `/.tmp/qdrant-hybrid-migration/<collection>-<ts>.jsonl`
   com `id + dense + payload` (rollback manual disponível).
3. **Drop + recreate** com schema hybrid via `ensureCorpusCollections`.
4. **Re-upsert** em batches:
   - dense original preservado em `vector.dense`.
   - sparse novo gerado via `buildLegalSparseVector(chunkText, payload)` em
     `vector.keywords`.
   - payload enriquecido (`workspaceId="_global_"`, `layer="legal_corpus"`,
     `textPreview`, `tokensEstimate`).
5. Rebuild dos payload indexes (idempotente via ensure).

`--dry-run`: imprime contagens, payload schema novo, primeiros 3 IDs e cardinalidade
sparse média, sem tocar Qdrant.

### `scripts/qdrant-ensure-indexes.ts` → `npm run qdrant:ensure-indexes`

Garante todos os indexes esperados (incluindo `is_tenant=true`) sem mexer em
dados — útil pós-deploy ou quando se adiciona um novo index ao
`COMMON_INDEXES`.

### `scripts/qdrant-inspect-indexes.ts` → `npm run qdrant:inspect-indexes`

Diagnóstico read-only: lista cada collection do corpus, conta pontos, descreve
named/sparse vectors e compara payload indexes contra os esperados — destaca
faltantes em vermelho. Usado como gate manual antes de promover hybrid em
prod.

### `scripts/qdrant-reindex-sparse.ts` → `npm run qdrant:reindex-sparse`

Reindexa **somente sparse** em uma collection já hybrid, sem tocar dense:
busca chunks no Postgres pelo `vectorPointId`, reconstrói o sparse e faz
upsert preservando `vector.dense` original. Permite atualizar a heurística de
boosts ou fix de bugs no tokenizer **sem** reembedar 514 chunks.

---

## 7. FASE 7 — Hybrid Search com RRF nativo

`src/lib/retrieval/legal/hybrid-qdrant.ts` (novo).

**Caminho feliz** (Qdrant ≥ 1.10 com sparse vectors configurados):

```ts
client.query(collection, {
  prefetch: [
    { query: denseVec, using: "dense", limit: prefetchLimit },
    { query: { indices, values }, using: "keywords", limit: prefetchLimit },
  ],
  query: { fusion: "rrf" },
  limit: args.limit,
  filter: corpusFilter,
  with_payload: true,
});
```

Fusion ranqueada **dentro do servidor** Qdrant — economia de round-trips.
Marca `trace.fallbackFlags.hybrid_native_used = true`.

**Fallbacks (degradação graciosa):**

1. **`prefetch+rrf` indisponível** (versão antiga / sparse não configurado):
   chama `client.query` em paralelo (dense `using:"dense"` + sparse
   `using:"keywords"`), aplica `fuseRRFInCode(k=60)` localmente, marca
   `hybrid_native_unavailable`.
2. **`client.query` retorna 400** (collection legada com vetor sem nome):
   cai para `client.search({ vector })` clássico, marca `sparse_unavailable`
   + `hybrid_unavailable`.
3. **Sparse vector vazio** (query muito curta): pula a etapa sparse, roda
   só dense, marca `sparse_unavailable`.

**Timings** (`denseMs`, `sparseMs`, `fusionMs`) capturados localmente em
variáveis (sem globais — thread-safe) e propagados ao trace.

**Testes** (`hybrid-qdrant.test.ts`): valida `buildCorpusNormsFilter` injeta
`workspaceId` (ambos), `status="ACTIVE"`, e preserva filtros do user.

---

## 8. FASE 8 — Filtros + integração

`src/lib/retrieval/legal/dense.ts`: `buildQdrantFilter` re-exporta
`buildCorpusNormsFilter` (fonte única de verdade). `searchDense` agora usa
`client.query({ using: "dense" })` com fallback automático para
`client.search({ vector })` quando a collection ainda não migrou.

`src/lib/retrieval/legal/index.ts` (`retrieveLegalContext`):

- **Hybrid Qdrant** substitui o loop dense puro como fonte principal.
- **Postgres FTS** continua executando em paralelo (boost/backup).
- **RRF final** funde hybrid hits + FTS hits (fontes "qdrant" e "fts").
- "Soften filters" fallback (quando hits < limit) também usa hybrid.
- Acumula `denseMsAcc`, `sparseMsAcc`, `ftsMs`, `fusionMsHybrid`,
  `fusionMsFinal`.

`src/lib/retrieval/legal/types.ts`: `LegalRetrievalTrace` ganhou:

```ts
timings: { denseMs, sparseMs, ftsMs, fusionMs }
cache:   { hit: boolean, backend: "redis" | "lru" | null }
fallbackFlags: [
  ..., "hybrid_unavailable", "hybrid_timeout",
  "hybrid_native_unavailable", "sparse_unavailable"
]
```

---

## 9. FASE 9 — Cache e latência

`src/lib/retrieval/legal/cache.ts`:

- **Prefix bumped:** `v2` → `v3` (invalida caches antigos automaticamente).
- **`buildCacheKey(query, filters, corpusContentHash?)`** — novo argumento
  opcional. `retrieveLegalContext` injeta um agregado de
  `LegalNormVersion.contentHash` (todas as `ACTIVE`), cacheado por 60s para
  evitar hot-path Postgres.
- Atualização de qualquer norma muda o agregado → chave nova → re-busca
  natural sem `cache.invalidate()` manual.
- `readCachedResult` agora retorna `backend ∈ {"redis","lru"}` e popula
  `trace.cache = { hit, backend }`.

`scripts/cf-retrieval-briefing.ts` (`npm run qa:search:legal`) imprime, por
query: `cold ms`, `warm ms`, `dense/sparse/fts/fuse` (cold), `fallbackFlags`,
e summary `cold avg/p95` + `warm avg/p95`.

---

## 10. FASE 10 — ColBERT (design only)

`src/lib/env.ts`: `LEGAL_COLBERT_ENABLED` (boolean, default `false`).

[`docs/COLBERT_LEGAL_RETRIEVAL.md`](../COLBERT_LEGAL_RETRIEVAL.md): especifica
collection separada `lex_corpus_norms_colbert` com multivectors (`MaxSim`),
ingest paralelo opcional, uso como **3º estágio** (rerank do top-50 hybrid)
em queries marcadas `deep:true`. **Não há código.** Métricas de custo
estimadas (~10× armazenamento, ~3× latência) justificam ser opt-in.

---

## 11. FASES 11–12 — QA + tests

### `qa:search:legal` — 15 queries cobrindo

1. Princípios fundamentais (dignidade, devido processo, contraditório,
   razoável duração).
2. Competências (Art. 22, art 92).
3. Ciência/Tecnologia (Art. 218 e 219).
4. ADCT/Estado (Art. 96, Art. 235).
5. Precatórios (Art. 100), administração pública (Art. 37).
6. Buscas literais ("art 5 lv", "artigo 92 conselho nacional de justiça").
7. Buscas com prefixo "art N" combinado a tema livre.

Cada query roda em **modo cold** (Redis flush + LRU clear) e **modo warm**
(re-execução imediata). Pass = top-1/top-3 contém qualquer `articleRef` da
lista esperada.

**Resultado final:** **15/15 ✓**.

| Métrica | Cold | Warm |
|---|---|---|
| avg ms | 3163 | 6 |
| p95 ms | 4549 | 84 |

Speedup warm = ~525× (cache LRU; em produção com Redis, esperamos warm 1–3ms).

### Suíte de testes

- **65 arquivos / 473 testes — 100% pass.**
- Novos: `sparse.test.ts`, `hybrid-qdrant.test.ts`, `dense.test.ts`
  (multi-tenant + legacy compat).
- `cache.test.ts` atualizado para prefix `v3` + `corpusContentHash`.

---

## 12. FASE 13 — Validações finais

| Check | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✓ no warnings/errors |
| Typecheck | `npm run typecheck` | ✓ no errors |
| Tests | `npm test` | ✓ 473/473 |
| Build | `NODE_ENV=production npm run build` | ✓ build complete |
| QA | `npm run qa:search:legal` | ✓ 15/15 (cold avg 3163ms / warm avg 6ms) |

---

## 13. Operação

### Ordem recomendada para promover hybrid em produção

1. **Backup:** snapshot Qdrant + dump Postgres (rotineiro).
2. **Dry run:** `npm run qdrant:migrate-hybrid:dry` — confere contagens,
   payload novo, IDs amostrais.
3. **Migração:** `npm run qdrant:migrate-hybrid` — drop+recreate+reupsert
   preservando dense (sem reembedar). Snapshot local em
   `.tmp/qdrant-hybrid-migration/`.
4. **Sanidade:** `npm run qdrant:inspect-indexes` — confirma named dense +
   sparse + indexes (incluindo `is_tenant=true` em `workspaceId`).
5. **QA:** `npm run qa:search:legal` — espera 15/15 e
   `fallbackFlags.hybrid_native_used` ATIVO em pelo menos uma query (sinal de
   que prefetch+rrf nativo funcionou).
6. **Sparse-only updates** (mudanças no tokenizer/boosts): `npm run
   qdrant:reindex-sparse <collection>` — não toca dense, não reembeda.

### Observabilidade pós-deploy

`LegalRetrievalTrace` agora carrega tudo necessário para dashboards:

- `timings.{denseMs, sparseMs, ftsMs, fusionMs}` para latência por estágio.
- `cache.{hit, backend}` para cache hit-rate por backend.
- `fallbackFlags` para detectar regressão (ex.: se `hybrid_native_unavailable`
  começa a aparecer em prod, indica problema de versão Qdrant ou config).

---

## 14. Arquivos tocados

**Novos (código):**
- `src/lib/retrieval/legal/sparse.ts` (+ test)
- `src/lib/retrieval/legal/hybrid-qdrant.ts` (+ test)
- `src/lib/retrieval/legal/qdrant-corpus-filter.ts`

**Novos (scripts):**
- `scripts/qdrant-migrate-hybrid.ts`
- `scripts/qdrant-ensure-indexes.ts`
- `scripts/qdrant-inspect-indexes.ts`
- `scripts/qdrant-reindex-sparse.ts`

**Novos (docs):**
- `docs/COLBERT_LEGAL_RETRIEVAL.md`
- `docs/reports/RAG_HYBRID_PIPELINE_AUDIT.md`
- `docs/reports/RAG_HYBRID_SEARCH_UPGRADE.md` (este arquivo)

**Modificados:**
- `src/lib/constants.ts` — `LEGAL_CORPUS_TENANT_ID`, `CORPUS_LAYER_*`.
- `src/lib/corpus/qdrant-collections.ts` — named dense + sparse + `is_tenant`.
- `src/lib/corpus/embeddings-pipeline.ts` — payload enriquecido + sparse.
- `src/lib/retrieval/legal/dense.ts` — Query API + fallback + filtro unificado.
- `src/lib/retrieval/legal/dense.test.ts` — multi-tenant filter coverage.
- `src/lib/retrieval/legal/index.ts` — orquestração hybrid + breakdown timings.
- `src/lib/retrieval/legal/types.ts` — `timings` + `cache` + flags.
- `src/lib/retrieval/legal/cache.ts` — prefix v3 + `corpusContentHash` + backend.
- `src/lib/retrieval/legal/cache.test.ts` — prefix v3 + corpus hash.
- `src/lib/env.ts` — `LEGAL_COLBERT_ENABLED`.
- `scripts/cf-retrieval-briefing.ts` — 15 queries cold/warm + breakdown.
- `package.json` — scripts npm `qdrant:*` e `qa:search:legal`.

**Não tocados (conforme briefing):**
- Markdown da Constituição.
- Pipeline de ingest da CF (514 chunks/514 pontos preservados — não reimportado).
- UI / componentes visuais.
- Schemas de usuários, workspaces, processos, documentos, uploads.

---

## 15. Critérios de sucesso (do briefing) — cumpridos

- [x] Hybrid search real (dense + sparse) com RRF nativo do Qdrant + fallback in-code.
- [x] Sparse vectors com tokenização e boosts jurídicos.
- [x] Payload indexes completos com `is_tenant=true` em `workspaceId`.
- [x] Multitenancy correta (`_global_` + `legal_corpus` layer) com compat legado.
- [x] Cache invalidando por `corpusContentHash`; backend exposto no trace.
- [x] Latência decomposta (`denseMs`, `sparseMs`, `ftsMs`, `fusionMs`) + cache hit.
- [x] QA com 15 queries cold/warm — 15/15 ✓.
- [x] ColBERT como design opcional, feature flag desligada por padrão.
- [x] Lint / typecheck / test / build verdes.
- [x] **Sem reset, sem reimport da CF, sem alterar UI/usuários/uploads.**
