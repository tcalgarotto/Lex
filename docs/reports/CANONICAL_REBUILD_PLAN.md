# Reset canônico da busca indexada — plano executivo

**Branch:** `corpus/canonical-rebuild`
**Iniciado:** 2026-05-08
**Objetivo:** resetar completamente o corpus jurídico vetorial e reconstruir o
pipeline de busca indexada sobre a arquitetura canônica (`LegalNorm` / `LegalNormVersion` /
`LegalChunk` / `LegalCitation`), sem features visuais novas, sem mexer em auth,
billing ou onboarding.

## Estado pré-reset (snapshot 2026-05-08 ~13:30 BRT)

**Postgres** (`bvidtxgzqyzxgusblcam.supabase.co`):

| Tabela              | Linhas |
| ------------------- | ------ |
| `LegalNorm`         | 16     |
| `LegalNormVersion`  | 16     |
| `LegalChunk`        | 7 498  |
| `LegalCitation`     | 194    |
| `IngestionJob`      | 19     |
| `IngestionWatermark`| (a verificar) |
| `LegalSource`       | 11 (legacy)   |

Quebra por kind: 8 ORDINARY_LAW · 6 CODE · 1 CONSTITUTION · 1 SUMULA_VINCULANTE.
Top tribunais: 15 sem tribunal · 1 STF.
Jobs: 19 jobs FIXTURE (legacy de demo + Planalto seed da sessão anterior, todos
processados via `manualRunOnce`).

**Qdrant** (`c43037b0-...sa-east-1.aws.cloud.qdrant.io`):

| Collection                  | Points |
| --------------------------- | ------ |
| `lex_corpus_norms`          | 7 519  |
| `lex_corpus_jurisprudence`  | 0      |
| `lex_main` (docs usuário)   | 428 (snapshot anterior) |

**Provider statuses:** Planalto, LexML, STF, STJ, Câmara, Senado e Fixture =
`ok`. DataJud = `not_configured` (esperado — sem chave).

## Princípios

- **Preservar**: usuários, workspaces, processos, documentos do usuário,
  auth, dashboard, billing, onboarding, `Document`/`DocumentChunk`,
  `LegalPiece`, `Process*`, `Workspace*`, `Subscription*`, `Activity`,
  `JobRun`, `ObservabilityLog`.
- **Apagar**: `LegalSource` (model + tabela + código), `LegalChunk`,
  `LegalCitation`, `LegalNormVersion`, `LegalNorm`, `IngestionJob`,
  `IngestionWatermark`, points de corpus em Qdrant.
- **Manter intocado**: `lex_main` no Qdrant continua sendo a collection
  *do usuário* (uploads). Não mais usada para corpus jurídico.

## Pipeline canônico (FASE 3 do briefing)

```
Provider (Planalto / LexML / STF / STJ / DataJud / Senado / Câmara)
   │
   ▼ fetch + decode
normalize → CorpusPayload (markdown limpo, breadcrumb, hierarchy preserved)
   │
   ▼ legal-chunker-v2 (article granularity + windowSplit fallback)
metadata JSON (norm + version + chunk + citations)
   │
   ▼ embeddings-pipeline (BGE-M3 1024d, batched, deduped por contentHash)
Postgres canonical (LegalNorm / LegalNormVersion / LegalChunk / LegalCitation)
   │
   ▼ upsert idempotente
Qdrant (lex_corpus_norms ou lex_corpus_jurisprudence)
   │
   ▼ collectionForKind(norm.kind)
citation graph (1-hop expansion via LegalCitation)
   │
   ▼ retrieveLegalContext (intent → rewrite → dense+bm25 → RRF → graph → rerank)
caller (chat / strategy / cases / pieces)
```

**Proibido**: embeddings diretos de PDF cru, embeddings sem `contentHash`,
embeddings em `lex_main` para corpus jurídico, retrieval jurídico fora de
`retrieveLegalContext`.

## Sub-fases

| # | Subfase                                                 | Status      |
| - | ------------------------------------------------------- | ----------- |
| A | Snapshot + branch + plano                               | done        |
| B | Schema cleanup (drop `LegalSource`, remover usos)       | pending     |
| C | Reset DB (truncate corpus tables)                       | pending     |
| D | Reset Qdrant (drop/recreate corpus collections)         | pending     |
| E | Re-ingest 15 leis Planalto via pipeline canônico        | pending     |
| F | Ingest súmulas STF/STJ (jurisprudência)                 | pending     |
| G | Consolidar retrieval (`retrieveLegalContext` único)     | pending     |
| H | Lint + typecheck + tests + build + relatório final      | pending     |

## Arquivos a editar/remover (Sub-fase B)

**Remover (arquivos legacy):**
- `src/lib/services/corpus-index.ts` (indexLegalSourcesToQdrant)
- `src/lib/inngest/functions/reindex-corpus.ts` (chama indexLegalSources)

**Editar (remover usos de `LegalSource`):**
- `src/lib/retrieval/hybrid-retriever.ts` (linhas 128-150, 259-276)
- `src/lib/corpus/source-visibility.ts` (remover `legalSourceProductionWhere`,
  `legalSourceProductionRawSql`)
- `src/lib/corpus/source-visibility.test.ts`
- `src/app/(app)/biblioteca/page.tsx` (reescrever para `LegalNorm`)
- `src/app/api/search/route.ts` (remover bloco `LegalSource`)
- `src/app/api/search/sanitization.test.ts`
- `scripts/qa-production.ts` (remover `demo-isolation-source`)
- `prisma/schema.prisma` (drop model)

**Adicionar:**
- Migration Prisma `drop_legal_source` (DROP TABLE).

## Arquivos a editar para reset (Sub-fase C)

- Novo: `scripts/corpus-reset.ts` — TRUNCATE encadeado e idempotente para
  `LegalChunk` → `LegalCitation` → `LegalNormVersion` → `LegalNorm` →
  `IngestionJob` → `IngestionWatermark`.

## Reset Qdrant (Sub-fase D)

- Novo: `scripts/qdrant-reset-corpus.ts` — `client.deleteCollection` em
  `lex_corpus_norms` e `lex_corpus_jurisprudence`, depois
  `ensureCorpusCollections` (que já cria payload indexes completos).
- `lex_main` preservado.

## Re-ingest (Sub-fase E + F)

- E: rodar `corpus:seed:official-laws` (script existente, 15 leis Planalto).
- F: rodar `corpus:sync` para STF/STJ (súmulas), com `--dry-run` primeiro.

## Validação (Sub-fase H)

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run qa:production`
- Relatório final com métricas: norms, chunks, citations, collection sizes,
  top providers, coverage por área, dedupe stats, latência média retrieval,
  recall em queries-canário.
