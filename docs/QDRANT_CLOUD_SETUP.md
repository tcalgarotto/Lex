# Qdrant Cloud — setup para o Lex

## Por que Qdrant Cloud

- Hybrid search nativo (dense + sparse).
- Collection-level config (vector size, distance, replication).
- Free tier 1GB suficiente para o corpus inicial (CF/88 + CDC + CC + CPC).
- Integração simples com `@qdrant/js-client-rest`.

## Setup

1. https://cloud.qdrant.io → Create Cluster
   - Region: `aws-sa-east-1` (Brasil) ou `aws-us-east-1`.
   - Tier: Free 1GB → upgrade Standard quando o corpus crescer.
2. Copie `QDRANT_URL` (algo como `https://xxxx.aws.cloud.qdrant.io`).
3. API Keys → Create → escopo Admin (apenas para init/script) e Read/Write (para o app).
4. Vercel envs:
   - `QDRANT_URL` (Production + Preview)
   - `QDRANT_API_KEY` (Production + Preview)
   - `QDRANT_REQUIRED=true` (Production)

## Inicializar collections

O Lex usa 3 collections:

| Collection | Conteúdo | Vector size |
|---|---|---|
| `lex_corpus_norms` | Constituição, leis, decretos, súmulas | 1024 (BGE-M3) |
| `lex_corpus_jurisprudence` | Acórdãos, decisões | 1024 (BGE-M3) |
| `lex_main` (legacy) | Documentos do usuário (uploads) | 1024 |

Criar tudo de uma vez:
```bash
QDRANT_URL=https://xxx.qdrant.io \
QDRANT_API_KEY=... \
npm run qdrant:init
```

## Smoke test

```bash
curl -H "api-key: $QDRANT_API_KEY" \
  "$QDRANT_URL/collections" | jq '.result.collections[].name'
```

Esperado: `lex_corpus_norms`, `lex_corpus_jurisprudence`, `lex_main`.

## Comportamento esperado

- Em produção, `QDRANT_REQUIRED=true` → `/api/health` vira 503 se Qdrant cair.
- Em dev, sem Qdrant: retrieval cai para BM25 puro (PG FTS). `trace.fallbackFlags` inclui `dense_unavailable` e/ou `qdrant_unavailable`.

## Backup / migration

Use `qdrant_client.snapshots()` ou exporte payloads via:
```bash
QDRANT_URL=... QDRANT_API_KEY=... npm run corpus:sync
```

## Cuidados

- Não dropar collection em produção sem snapshot.
- Vector size precisa bater com o modelo de embedding (`BGE-M3 = 1024`). Mudar embedding implica reindex completo.
- Payload indexes para `tribunal`, `kind`, `articleRef`, `validFromTs` aceleram filtros do retrieval.
