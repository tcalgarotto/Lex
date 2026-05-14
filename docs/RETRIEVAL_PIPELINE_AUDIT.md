# Retrieval Pipeline Audit — Lex

> Auditoria consolidada do pipeline de busca (Pesquisa Jurídica + busca global) e seus guardrails.
> Última atualização: 2026-05-09.

## 1. Objetivo

Garantir que a pesquisa jurídica do Lex:
- funciona para query natural e técnica
- retorna fonte real (citável) do corpus indexado
- não mistura corpus oficial com documentos do workspace sem escopo claro
- tem modo debug para admin/dev sem vazar PII

## 2. Arquitetura (fonte de verdade)

Ver `docs/CORPUS_INDEXED_RETRIEVAL_ARCHITECTURE.md`.

- **Corpus oficial**: `retrieveLegalContext` → Postgres (`LegalNorm*`, `LegalChunk`) + Qdrant (`lex_corpus_*`).
- **Workspace**: `retrieveContext` → Postgres (`DocumentChunk`, `LegalPiece`) + Qdrant (`lex_main`).
- **Busca global**: agrega e saneia resultados de ambos.

## 3. Riscos P0 a auditar continuamente

- Tenancy: ausência de filtro por `workspaceId` em `lex_main` ou cache.
- Grounding: citar norma fora do corpus como se fosse recuperada.
- ADCT irrelevante dominando resultados fora de contexto.
- Regressão de `articleRef` (normalização de `Art. 5` vs `Art. 5º`).
- Logs com texto cru de chunks/documentos (PII).

## 4. QA sentinela (domínios)

Manter uma suíte “qa:retrieval:domains” com domínios sentinela:
- educação/creche
- saúde/medicamento
- consumidor/banco
- contratos
- família/alimentos
- mandado de segurança
- acesso à justiça
- meio ambiente
- STF/recurso extraordinário
- administração/concurso

## 5. Evidências (preencher)

- testes unit/integration/e2e relacionados
- logs de timings por etapa (dense/sparse/fts/fusion/rerank)
- exemplos de queries e resultados (com `normUrn/articleRef` e trecho)

## 6. Status

**Status**: NOT READY (auditoria por evidência não executada nesta atualização).

