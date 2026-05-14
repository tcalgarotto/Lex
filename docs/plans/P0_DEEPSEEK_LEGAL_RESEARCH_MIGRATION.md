# Plano P0 — Migração da pesquisa jurídica para modo DeepSeek (temporário)

## Objetivo

Habilitar pesquisa e recomendação utilizáveis em **demo controlada** e **piloto interno**, sem remover o motor interno existente, com reversão imediata por configuração.

## Kill-switch

| Variável | Efeito |
|---------|--------|
| `LEGAL_RESEARCH_PROVIDER` com **valor stub legado** (503; ver `src/lib/legal-research/provider.ts` e ADR) | Respostas da API de pesquisa nova retornam **503** com mensagem amigável; não aciona `retrieveLegalContext`. |
| `DEEPSEEK_LEGAL_RESEARCH_ENABLED=false` | Com `LEGAL_RESEARCH_PROVIDER=deepseek`, rotas `search` / `recommend-for-case` retornam **503**. |
| `DEEPSEEK_API_KEY` vazio / `DEEPSEEK_MODEL` vazio | Chamadas DeepSeek falham com erro tratado na resposta estruturada. |

## Rollback em 1 PR

1. Definir `LEGAL_RESEARCH_PROVIDER` para o **valor stub legado** descrito no ADR (ou restaurar consumo apenas de `/api/retrieval/search` na UI, Lane E).
2. Remover ou ocultar entradas de menu que apontem para `/api/legal-research/*` se necessário (Lane C/D).
3. Nenhuma migration foi adicionada nesta lane — rollback não exige `prisma migrate`.

## Adapter de compatibilidade

- Arquivo: `src/lib/legal-research/retrieval-adapter.ts`, função `buildRetrievalSearchCompatiblePayload`.
- Quando `LEGAL_RESEARCH_PROVIDER !== "deepseek"`, o adapter devolve payload vazio com `legalResearchAdapter: "unavailable"` e mensagem em `confidence.reason`.
- **A rota** `src/app/api/retrieval/search/route.ts` **não foi alterada** — o cutover na UI fica para a **Lane E**.

## Gates pré-promoção (bloqueio público pagante)

- Gold-set de consultas com resposta esperada mínima (precisão de citação legislativa).
- Benchmark de latência p95 < alvo definido em `docs/governance/QUALITY_THRESHOLDS.md` (atualizar baseline quando existir).
- Revisão Legal em lote de 20 jurisprudências candidatas reais (zero tolerância a número de processo inventado em modo não marcado como fictício).
- Security: revisão de vazamento de PII em logs (regex de scrub já aplicada; validar amostragem).

## Baselines a medir

- Tokens médios por consulta (`promptTokens`, `completionTokens` nos logs JSON-line).
- Taxa de erro de parse JSON (`providerMetadata.parseError`).
- Latência p50/p95 (`durationMs` nos logs).
- Taxa de 429 do rate limit por workspace.

## Checkpoint para reativar o motor interno

1. Feature flag futura para priorizar o motor interno na pesquisa principal (nome a definir na implementação), alinhada a critérios em `docs/CORPUS_INDEXED_RETRIEVAL_ARCHITECTURE.md`.
2. Desligar progressivamente o modo DeepSeek após validação em staging com **mesmas** queries do gold-set.
3. Lane E decide se `/api/retrieval/search` passa a orquestrar adapter + motor interno ou apenas motor interno.

## TODOs de coordenação

| Lane | Entrega |
|------|---------|
| **B** | `addPinnedFoundationToCase(caseId, candidate)` + modelo de persistência para candidatos sem `chunkId` de corpus. |
| **C/D** | Importar `@/lib/legal-research` (barrel) nas telas e textos legais. |
| **E** | QA integrado, typecheck/lint/build, decisão de cutover do adapter vs rota legada. |
