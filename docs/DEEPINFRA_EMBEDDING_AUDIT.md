# DeepInfra Embedding Audit — Lex

> Auditoria de embeddings/reranker via DeepInfra (modelos, dimensões, latência, cache e riscos).
> Última atualização: 2026-05-09.

## 1. Objetivo

Garantir que:
- o modelo de embedding é consistente com as dimensões das collections Qdrant
- há observabilidade (latência, rate limits, falhas)
- cache/dedupe evita custo desnecessário
- falhas de IA não viram erro silencioso
- logs não vazam PII

## 2. Evidência documentada (referências)

- `docs/reports/CORPUS_HYBRID_PIPELINE_AUDIT.md`
- `docs/reports/CORPUS_HYBRID_SEARCH_UPGRADE.md`

## 3. Itens a confirmar por evidência (P0)

- ⏳ **Embedding model**: nome/versão (ex.: BGE-M3) e dimensão (ex.: 1024).
- ⏳ **Reranker model**: nome/versão e thresholds.
- ⏳ **Timeouts**: limites para evitar requests pendurados.
- ⏳ **Retries**: backoff e erro não-retentável.
- ⏳ **Cache**: chave por `contentHash` (chunks) e por query (retrieval).
- ⏳ **Logs**: scrub de segredos + não logar texto cru.

## 4. Metas de latência (produto)

- busca simples: ideal até 2s
- busca contextual: ideal até 5s

## 5. Status

**Status**: NOT READY (auditoria por evidência não executada nesta atualização).

