---
title: Architecture Stability Policy — Lex
status: reviewed
owners: [CTO, Tech Lead, retrieval owner, IA owner, Legal Lead]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/EXECUTION_BUDGETS.md
  - docs/governance/ROLLBACK_POLICY.md
  - docs/governance/FORBIDDEN_ORDERINGS.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/BENCHMARK_STRATEGY.md
  - docs/governance/STOP_CONDITIONS.md
tier: mvp
---

# Architecture Stability Policy — Lex

> **Documento canônico anti-refactor-infinito e anti-chaos.** Define **quando** uma camada do Lex pode mudar, **com que evidência**, **com que rollback**, e **quem assina**. Tem precedência sobre preferência pessoal, hype tecnológico e "vamos só refatorar para ficar melhor".
>
> **Princípio mestre**: **estabilidade é feature**. Trocar tecnologia, modelo, schema ou padrão **sem evidência forte** custa mais que o "ganho" prometido — e atrasa P0.

---

## 1. Schema de cada política

| Campo | Definição |
|-------|-----------|
| `id` | identificador estável (`A-XX-NN`) |
| `area` | stack / retrieval / embeddings / chunking / schema-api / ux-core / prompts |
| `o_que_pode_mudar` | mudanças permitidas com regra leve |
| `o_que_nao_pode_mudar` | mudanças bloqueadas sem regra forte |
| `evidencia_obrigatoria` | benchmarks, métricas, RFCs, sign-offs |
| `rollback_plan` | referência a [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md) |
| `migration_strategy` | quando aplicável (forward-only, coexistência, big-bang) |
| `aprovacao` | quem assina |

---

## 2. A — Stack core

### A-01 — Quando a stack core pode mudar

Stack atual auditada e operada (2026-05-09):

- **Frontend/Server**: Next.js 15 (App Router), React 19.
- **DB**: Postgres via Supabase + Prisma 6.
- **Auth**: Supabase Auth + custom session em `src/lib/auth/**` (5 roles `MembershipRole`).
- **Storage**: Supabase Storage (bucket `documents` privado + RLS por workspace).
- **Vector DB**: Qdrant (cloud) — coleções `lex_corpus_norms`, `lex_corpus_jurisprudence`.
- **Cache + rate-limit**: Redis (Upstash/Redis Cloud).
- **Jobs assíncronos**: Inngest (cloud).
- **Embeddings**: BGE-M3 via DeepInfra.
- **Reranker**: BGE-reranker-v2-m3 via DeepInfra.
- **LLM**: DeepSeek (com adapters preparados para OpenAI/Anthropic via `@ai-sdk/*`).
- **Observabilidade**: Langfuse + logger custom + `/api/health` + `/api/ready`.
- **Deploy**: Vercel.

**Pode mudar com regra leve** (RFC + 1 sprint planejamento):

- Versão **patch** das libs (`x.y.Z`) sem CVE conhecido.
- Add-on opcional sem cobrir caminho crítico.

**Pode mudar com regra forte** (RFC + benchmark + sign-off triplo):

- Versão **minor** de Next.js, Prisma, Supabase SDK, Inngest SDK, Qdrant client.
- Adicionar provider LLM/embedding ao lado de DeepSeek/DeepInfra (multi-provider routing — só se `F-O-07` permitir).

### A-02 — O que **não** pode mudar (sem RFC + ≥1 trimestre de operação estável)

- Trocar **framework** (Next.js → outro) — proibido sem 6 meses de operação estável + 3 alternativas comparadas.
- Trocar **DB** (Postgres/Supabase → outro) — proibido salvo SLA enterprise específico.
- Trocar **vector DB** (Qdrant → outro) — proibido salvo redução de custo/latência > 50% comprovada.
- Trocar **provider de embeddings** (BGE-M3 → outro) — ver `A-03`.
- Trocar **provider de LLM** primário sem coexistência multi-model previa.
- Mudar **filosofia de deploy** (Vercel → on-prem) — só com cliente enterprise contratado.

### A-03 — Evidência obrigatória para troca de stack core

| Mudança | Evidência mínima |
|---------|------------------|
| Framework | 3 alternativas em RFC; benchmark de bundle/cold start/HMR; estimativa de migration; ≥ 6 meses operação estável atual; sign-off CTO + PO |
| DB | benchmark p95 query; impacto em RLS; impacto em backup/DR; sign-off CTO + Security Lead + banco owner |
| Vector DB | benchmark hits@5 + p95 + custo; coexistência paralela ≥ 2 sprints; sign-off CTO + retrieval owner + QA Lead |
| Provider LLM/embedding | ver A-C-01..A-C-04 |
| Deploy / hosting | RFC + DR plan + custo total | sign-off CTO + PO + (Legal Lead se data residency) |

### A-04 — Rollback de stack core

- **Coexistência obrigatória** durante migração (não big-bang).
- **Plano de retorno** documentado **antes** de iniciar (referência: [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md) §4.12).
- **Janela de validação** ≥ 30 dias antes de descomissionar tecnologia anterior.

---

## 3. B — Retrieval

### A-B-01 — Mudanças em Qdrant (cluster/coleção)

**Pode mudar com regra leve**:
- Tuning de parâmetros (ef_search, hnsw_m, on_disk) com benchmark antes/depois.
- Criação de índices secundários (`scripts/qdrant-ensure-indexes.ts`).

**Pode mudar com regra forte**:
- Migrar coleção (`scripts/qdrant-migrate-hybrid.ts`) — exige dry run + back-up + benchmark.
- Adicionar coleção nova (ex.: `lex_corpus_workspace_<id>` para documentos do caso).

**Não pode mudar sem regra forte**:
- Trocar dimensão de vetores (proibido sem coexistência + reindex).
- Trocar storage backend Qdrant (cloud → self-hosted) sem A-04.

### A-B-02 — Mudanças em metadata payload

- **Adicionar** campo: aceito sem migration; PR com docs.
- **Renomear** campo: exige duplicação temporária + migration de readers + drop em N+2 release.
- **Remover** campo: proibido enquanto qualquer reader em prod usar.

### A-B-03 — Mudanças em hybrid search (BM25 + Dense + RRF)

- **Tuning de pesos** (alpha em RRF k=60): exige benchmark hits@5 + MRR; sem regressão > 5%.
- **Mudar fórmula RRF** (k diferente, ou substituir RRF): exige RFC + benchmark + sign-off retrieval owner + QA Lead.
- **Substituir BM25 por outro retriever léxico**: proibido sem benchmark forte.

### A-B-04 — Mudanças em rerank

- **Toggle on/off**: aceitável via env (`LEX_RERANK_ENABLED`); benchmark obrigatório.
- **Trocar modelo** (BGE-reranker-v2-m3 → outro): regra forte; A/B obrigatório.
- **Mudar cardinalidade** (top-N entrada do rerank): exige benchmark p95.

### A-B-05 — Mudanças em query expansion / rewrite

- `src/lib/retrieval/legal/rewrite.ts` (multi-query, expansão de aliases).
- **Adicionar alias** (ex.: nova lei + sigla): aceito; doc no PR.
- **Mudar lógica de rewriting** (ex.: trocar regex por LLM rewriter): regra forte; benchmark MRR.
- **Desativar rewriting**: regra forte; benchmark hits@5 antes/depois.

---

## 4. C — Embeddings

### A-C-01 — Troca de modelo

- **Modelo atual**: BGE-M3 via DeepInfra. Vetores indexados em `lex_corpus_norms` + `lex_corpus_jurisprudence`.
- **Pode trocar** apenas com:
  1. RFC com 3 alternativas e custos.
  2. Benchmark gold-set CF/88 + domínios + adversarial **antes** e **depois** (suíte A do `BENCHMARK_STRATEGY.md`).
  3. Coexistência: nova coleção `legal-corpus-v2` paralela ≥ 2 sprints.
  4. Cap de custo recalculado (B-B-04).
  5. Sign-off: CTO + IA owner + retrieval owner + QA Lead.

### A-C-02 — Dimensão

- **Dimensão atual**: 1024 (BGE-M3 dense).
- **Não pode mudar** dimensão sem coleção paralela + reindex completo.
- Mudar dimensão **invalida** cache (`lex:retrieval:legal:v2:` prefix); incrementar versão de prefix.

### A-C-03 — Coexistência de coleções

- Política **default**: durante troca, manter coleção antiga **read-only**, indexar nova; roteamento por flag `LEX_EMBEDDING_VARIANT`.
- Após validação, descomissionar antiga em janela ≥ 30 dias.

### A-C-04 — Reindex

- Pré-condição: estimativa de custo (B-B-04) + janela operacional (`B-C-04` hardening cycle ou exclusivo).
- Throttle de pipeline (default 30/min em `embeddings-pipeline.ts`).
- Monitoramento contínuo de erro/timeout (S-04, Q-F-08).

### A-C-05 — Custo

- Cap por reindex (B-B-04).
- Cap mensal DeepInfra (B-B-07).
- Spike permitido por dia (Q-G-05).

### A-C-06 — Rollback de embedding

- Toggle `LEX_EMBEDDING_INGEST_ENABLED=false` para parar nova ingestão.
- Reverter PR que mudou modelo.
- Manter coleção paralela até validar baseline novo.
- Em caso extremo: descomissionar coleção nova; voltar para antiga.

---

## 5. D — Chunking

### A-D-01 — Mudança de chunker

- **Chunker atual**: `src/lib/corpus/legal-chunker-v2.ts` (hierárquico, `fullPath`, refs intra-artigo).
- **Pode mudar** apenas com:
  1. RFC + 3 alternativas.
  2. `pnpm corpus:rechunk:articles:dry` em corpus completo.
  3. `pnpm corpus:validate-cf` (`scripts/cf-semantic-validate.ts`) aprovado.
  4. `pnpm corpus:audit-cf` (`scripts/cf-coverage-audit.ts`) sem regressão.
  5. Replay com gold-set (Q-A-01..Q-A-05).
  6. Sign-off: chunking owner + retrieval owner + Legal Lead + QA Lead.

### A-D-02 — Parent / child chunks

- Migration `20260509120000_legal_chunk_parent` introduziu `parentChunkId`.
- **Não alterar** estrutura `parent → child` sem coexistência (chunker novo deve preencher campo).
- **Drop** de `parentChunkId` proibido.

### A-D-03 — Article / inciso / parágrafo

- Estrutura tipada (`articleRef`, `structure`) é input para boost (A-B-03/Q-A-05) e para citation accuracy (Q-B-04).
- **Não alterar** semântica de `articleRef` sem migrar dados existentes.

### A-D-04 — Validação semântica

- Toda mudança em chunker → rodar `cf-semantic-validate` + revisão Legal Lead amostral (≥ 20 chunks chave da CF/88).

### A-D-05 — Replay tests

- Suíte de replay: gold-set CF/88 → re-executar pipeline com chunker novo → comparar hits@5 / MRR / citation accuracy.
- Critério: regressão ≤ 5% por métrica; se > 5%, reverter.

---

## 6. E — Schema / API

### A-E-01 — Compatibility layer

- Toda migration em `prisma/migrations/**` deve ser **backwards-compatible** (DoD-03).
- Padrão **N → N+1 → N+2**:
  - **N**: introduz coluna nova nullable / tabela paralela.
  - **N+1**: leitores migram; readers antigos seguem operando com fallback.
  - **N+2**: drop de coluna/tabela antiga (nunca antes).

### A-E-02 — Versionamento de API pública

- Hoje: 0 APIs públicas externas; rotas em `src/app/api/**` consumidas pelo próprio app.
- Quando API pública for liberada (P4 / `F-O-16`): versionar (`/api/public/v1/**`); cada quebra exige `/v2`.

### A-E-03 — Deprecations

- Rota / coluna / campo a deprecar:
  1. Marcar `@deprecated` no schema/comentário no PR de N.
  2. Notificar consumidores internos (PRs de migração de leitor).
  3. Drop em N+2 (mínimo 2 ciclos de release após deprecação).

### A-E-04 — Drop N+2

- **Proibido** dropar campo/tabela com dados sensíveis antes de N+2 (regra anti-dataloss).
- Exceção: `LegalSource` foi dropada em migration `20260508130000_drop_legal_source` porque tinha apenas dados DEMO; documentado na própria migration.

### A-E-05 — Backward compatibility

- API server actions e route handlers que mudem assinatura: manter overload temporário.
- Schemas Zod: adicionar `.optional()` ou novos campos `default`; jamais remover sem deprecation.

---

## 7. F — UX core

> Subsystems de UX que **não** podem mudar livremente sem RFC + smoke G-57:

### A-F-01 — Intake (`/cases/new`, `intake.ts`, `InterviewTemplate`)

- Estrutura: 5 campos básicos + roteiro guiado.
- **Não alterar** o **caminho mínimo** sem RFC; melhorar é permitido (paper-cuts).

### A-F-02 — Case page (`/cases/[id]`)

- Tabs: Fatos · Partes · Pedidos · Riscos · Minuta · Review · Timeline · Colaboração.
- **Adicionar** tab: aceito.
- **Reordenar** ou **remover** tab: regra forte; impacta jornada principal (jornada §3 do `PRODUCT_SURVIVAL_MODE.md`).

### A-F-03 — Library (`/biblioteca`)

- Estado atual ambíguo (Leva 1 §4.1): coexistem rotas `/biblioteca/**` reais com redirect anunciado no README.
- **Decisão pendente** (F0): consolidar em `/pesquisa-juridica?scope=legislacao` **ou** manter biblioteca com escopo distinto.
- Até decidir: **congelar** mudanças em `/biblioteca` exceto fix.

### A-F-04 — Research (`/pesquisa-juridica`)

- Pipeline `retrieveLegalContext` exposto via `/api/retrieval/search`.
- **Não mudar** semântica do resultado (chunks, scores, provenance, groundingScore) sem RFC.

### A-F-05 — Drafting (geração de peça no editor)

- Caminho: `/cases/[id]` → "Gerar peça" → editor → review → export.
- **Não alterar** ordem sem RFC; não introduzir geração sem `source-sufficiency` check.

### A-F-06 — Review (checklist 8 critérios)

- 8 critérios estabelecidos em `src/lib/cases/review.ts` (estrutura, grounding, pedido principal, urgência, fatos, normas revogadas, divergência jurisprudencial, issues).
- **Não remover** critério sem RFC + Legal Lead.
- **Adicionar** critério: aceito; documentar.

### A-F-07 — Export (DOCX, PDF)

- Endpoints `/api/cases/[id]/drafts/[draftId]/export` e `/api/pieces/[id]/export`.
- **Não alterar** formato de saída sem revisão tipográfica + Legal Lead.

---

## 8. G — Prompts (versionamento e gerenciamento)

### A-G-01 — Versionamento

- Toda mudança em prompts em `src/lib/ai/prompts/**` ou similar exige incremento de versão (`LEX_PROMPT_VERSION=v3`).
- Versão antiga acessível via env override por **2 ciclos**.
- Mudança não-versionada **proibida** (DoD-09).

### A-G-02 — Prompt registry (planejado, F2)

- Registry centralizado: `prompts/<feature>/<version>.md` com metadados (autor, data, motivação, gold-set associado).
- Hoje: prompts em código TS; F2 introduz registry.

### A-G-03 — Benchmark adversarial obrigatório

- Suíte B do `BENCHMARK_STRATEGY.md` roda em toda mudança de prompt.
- Sem benchmark, **proibido** mergear (`F-O-10`).

### A-G-04 — Rollback de prompt

- Toggle env `LEX_PROMPT_VERSION` volta para versão anterior em < 5 min.
- Detalhe em `ROLLBACK_POLICY.md §4.6`.

### A-G-05 — Monitoramento

- Toda saída IA em produção registrada (Langfuse) com `prompt_version` no trace.
- Spike de hallucination (Q-C-01) ou drop de groundingScore (Q-B-02) cruzados com versão do prompt para diagnóstico rápido.

---

## 9. H — Anti-chaos (filosofia anti-padrão)

> Lista oficial de "vontades de refactor" **proibidas** sem prova forte.

### A-H-01 — Proibido "reescrever tudo"

- Pedido tipo "vamos reescrever em Astro/Remix/SvelteKit" → **proibido** sem A-01 + A-04.
- Reescrita parcial (módulo isolado) só com RFC + plano de coexistência + benchmark.

### A-H-02 — Proibido refactor casual

- Refactor "porque ficou feio" → recusado se não cabe em B-A-02 (1 refactor por sprint, sem misturar com feature).
- Refactor enxuto e cirúrgico (renomear símbolo, extrair helper sem mudar contrato): aceito sob fast-path se ≤ 100 linhas.

### A-H-03 — Proibido mudar stack por preferência

- "Eu prefiro Drizzle a Prisma" → **proibido**; preferência ≠ evidência.
- "Vamos para Bun no runtime" → exige A-01 + A-04 + benchmark (e Vercel Functions já dão suporte, então ainda exige justificativa forte).

### A-H-04 — Proibido abstração prematura

- Não criar interface `IRetriever<TQuery, TContext>` quando há **1** implementação.
- Não generalizar para "qualquer LLM" antes de **2** providers reais em uso.
- Regra: a abstração **acompanha** o segundo caso de uso, não o antecipa.

### A-H-05 — Proibido enterprise prematuro

- "Vamos preparar isolamento por região" sem cliente enterprise contratado → **proibido** (`F-O-01`, `F-O-04`).
- "Vamos suportar SSO desde já" sem RBAC server-side maduro → **proibido** (`F-O-17`).
- Enterprise vem **depois** que MVP convence; nunca por antecipação.

### A-H-06 — Proibido microservicizar prematuramente

- Lex hoje é monolito Next.js (com Inngest para async).
- Quebrar em serviços (ex.: serviço dedicado de retrieval) **proibido** sem evidência forte de gargalo isolável + custo justificado.

### A-H-07 — Proibido reescrita de UI sem RFC + paper-cut log

- "Vamos modernizar o design" → exige RFC + A/B; paper-cuts pequenos via `B-C-01` (stabilization week) são aceitos.

### A-H-08 — Proibido "tooling-first"

- Adicionar tooling (Storybook, Chromatic, Bundler novo, monorepo Turborepo) sem **problema** real documentado → **proibido**.
- Tooling vem para resolver dor, não para "ficar moderno".

---

## 10. Tabela-resumo (quick reference)

| Área | # políticas | Status agregado |
|------|------------:|-----------------|
| A — Stack core | 4 | regras duras `known` |
| B — Retrieval | 5 | regras com toggle/benchmark |
| C — Embeddings | 6 | regras duras |
| D — Chunking | 5 | regras duras |
| E — Schema/API | 5 | regras duras (DoD-03) |
| F — UX core | 7 | regras duras com smoke G-57 |
| G — Prompts | 5 | regras duras (`F-O-10`, DoD-09) |
| H — Anti-chaos | 8 | regras culturais |
| **Total** | **45** | — |

---

## 11. Override

Override de qualquer item exige:

1. RFC com 3 alternativas e justificativa forte.
2. Sign-off por escopo:
   - A: CTO + PO.
   - B/C: CTO + IA owner + retrieval owner + QA Lead.
   - D: chunking owner + retrieval owner + Legal Lead + QA Lead.
   - E: CTO + banco owner + (Security Lead se sensível).
   - F: PO + UX owner + Legal Lead + (Security Lead se gating).
   - G: IA owner + Legal Lead + QA Lead.
   - H: PO + CTO.
3. Registro em `OVERRIDES_LOG.md`.
4. Revisão em 30 dias.

---

## 12. Como aplicar este doc

1. **Hoje**: políticas C, D, E, G, H entram em vigor imediato; A, B, F com revisão semanal pelo CTO.
2. **Próximo PR** que toque qualquer área: declarar "esta PR respeita `A-XX-NN`?" no template.
3. **F1**: instrumentar bot/CI para enforcer (`B-D-*` em `EXECUTION_BUDGETS.md`).
4. **F2**: introduzir prompt registry (A-G-02).

---

## 13. Anti-padrões proibidos (resumo executivo)

- "Vamos reescrever em X." → **proibido** sem A-01 + A-04.
- "Vamos abstrair antes." → **proibido** (A-H-04).
- "Vamos preparar para enterprise." → **proibido** (A-H-05, `F-O-01..F-O-17`).
- "Esse refactor casual aqui." → **proibido** se viola B-A-02 ou §5 do `EXECUTION_GOVERNANCE` (no scope creep).
- "Vamos só trocar o embedding rápido." → **proibido** sem A-C-01.
- "Vamos só ajustar esse chunker, nada vai quebrar." → **proibido** sem A-D-01.
- "Vamos aproveitar e mudar o prompt." → **proibido** sem A-G-01..A-G-03.

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md), [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md), [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md), [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md), [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md), [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md).
