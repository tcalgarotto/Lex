---
title: Execution Report — F-1 Leva 2
status: published
owners: [PO, CTO, Legal Lead, Security Lead, QA Lead]
audience: [dev, admin]
updated: 2026-05-10
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/F-1_SIGNOFF.md
  - docs/governance/OWNER_MATRIX.md
  - docs/governance/PRODUCT_SURVIVAL_MODE.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/TRUTH_HIERARCHY.md
  - docs/governance/FORBIDDEN_ORDERINGS.md
  - docs/governance/EXECUTION_BUDGETS.md
  - docs/governance/ARCHITECTURE_STABILITY_POLICY.md
  - docs/governance/BENCHMARK_STRATEGY.md
  - docs/governance/EXECUTION_REPORT_F-1_LEVA_1.md
tier: mvp
---

# Execution Report — F-1 Leva 2

> **Escopo executado**: criação da camada de governance **estendida** do Lex em `docs/governance/`. **Sem** alteração de código, retrieval, UI, configs, scripts, tests ou migrations. **Não** corrigiu inconsistências do `EXECUTION_REPORT_F-1_LEVA_1.md`.
>
> **Princípio aplicado**: governança vira **executável, mensurável e bloqueante** — fechando lacunas da Leva 1 (thresholds, hierarquia de verdade, ordenamentos proibidos, orçamentos, estabilidade, benchmarks). Onde não há baseline real, marcamos honestamente `unknown` e definimos `interim_rule` conservadora até F0/F2 medir.

---

## 1. Sumário executivo

### 1.1 Entregas (Leva 2)

| # | Documento | Status | Linhas |
|---|-----------|--------|-------:|
| 1 | [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md) | criado | 214 |
| 2 | [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) | criado | 748 |
| 3 | [`TRUTH_HIERARCHY.md`](TRUTH_HIERARCHY.md) | criado | 268 |
| 4 | [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md) | criado | 316 |
| 5 | [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md) | criado | 485 |
| 6 | [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md) | criado | 431 |
| 7 | [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) | criado | 662 |
| 8 | **Este relatório** | criado | — |

**Total Leva 2**: 7 documentos × ~3.124 linhas. Pacote `docs/governance/` cresceu de 8 docs (Leva 1) para **15 docs** (Leva 1 + Leva 2 + 2 reports), totalizando ~5.464 linhas (≈225 KB).

### 1.2 Não executado (proibido começar sem checkpoint explícito)

- Nenhuma alteração em código (`src/**`, `prisma/**`, `scripts/**`, `tests/**`, UI).
- Nenhuma alteração em retrieval, embeddings, chunker, prompts.
- Nenhuma alteração em configs (`vercel.json`, `next.config.ts`, `package.json`).
- Nenhuma migration nova.
- Nenhuma execução de script ou benchmark.
- Nenhuma correção das inconsistências do relatório Leva 1 (continuam pendentes para F0).
- Nenhuma promoção de release.
- F0 **não** iniciada.

### 1.3 Próximos checkpoints (sequência sugerida; aguarda PO + CTO)

1. **Sign-off completo de governance** (Leva 1 + Leva 2): assinaturas de PO + CTO + Legal Lead + Security Lead + QA Lead em `EXECUTION_GOVERNANCE.md` §13.
2. **Preencher `OWNER_MATRIX.md`** com nomes reais (todas as células `_a preencher_`).
3. **Iniciar F0 — Auditoria** (corrige Leva 1 §4–§8, mede baselines, popula gold-sets §9 do `BENCHMARK_STRATEGY.md`).
4. F1..F10 conforme `MASTER_ROADMAP.md` (a publicar em F0/F1).

---

## 2. O que cada documento resolveu

### 2.1 [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md) — 214 linhas

**Resolve**: ausência de filtro operacional para distinguir "feature legítima" de "distração". Define quando o produto está em **Survival Mode** (estado oficial **hoje**), 10 riscos existenciais ranqueados, jornada feliz mínima testável, lista canônica de **12 itens congelados** quando P0 está fraco, 10 métricas de sobrevivência (Q-cross), filtro de decisão de 5 perguntas para toda RFC, sinais de saída (descongelar) e regras de comunicação externa.

**Lacuna anterior fechada**: Leva 1 falava em "estabilizar antes de expandir" mas não dizia **o quê** congelar nem **quando**. Agora há lista oficial F-01..F-12.

### 2.2 [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) — 748 linhas

**Resolve**: gates e stop conditions sem números. Define **44 métricas oficiais** em 7 suítes:

- A — Retrieval (8): hits@1/3/5, MRR, cobertura por domínio, queries sem resposta, fallback rate, irrelevância no top-5.
- B — Grounding (6): score mínimo, mediano, % com fonte citável, citation accuracy, source existence (regra dura 100%), source text match.
- C — Legal quality (7): hallucination rate, unsupported claim, wrong article, ADCT irrelevante, normative mismatch, procedural incoherence, drafting blocker rate.
- D — Drafting (6): peça sem placeholder (regra dura 100%), partes corretas, pedidos corretos, fundamento aprovado, taxa de reprovação, export blocked.
- E — UX (4): completion rate jornada, dead-end reports, cobertura de loading/empty/error, tempo até próxima ação.
- F — Performance (8): p50/p95 retrieval/drafting/export, build time, 5xx, Qdrant timeout, DeepInfra timeout.
- G — Cost (5): custo por query/peça/caso/workspace/dia, spike permitido.

Cada métrica tem **11 campos** (id, definição, como medir hoje, baseline_atual, baseline_status, threshold MVP/Pro/Enterprise, owner, stop condition, gate, ação se falhar). **Honestidade**: 42 de 44 métricas estão `baseline_status: unknown` — aguardam medição em F0/F2 para virar `enforced`.

**Lacuna anterior fechada**: gates G-50..G-58 e stops S-01..S-05 referenciavam "baseline" e "regressão" sem números; agora têm thresholds (mesmo que `interim`).

### 2.3 [`TRUTH_HIERARCHY.md`](TRUTH_HIERARCHY.md) — 268 linhas

**Resolve**: ambiguidade sobre "o que pode ser fonte" no produto. Define **11 níveis** em ordem decrescente de autoridade:

1. Legislação oficial vigente (`LegalNorm`/`LegalNormVersion`/`LegalChunk`).
2. Jurisprudência oficial (STF/STJ/TST/etc).
3. Tribunal/Processo oficial (PJe/eSAJ/Projudi/eproc/DataJud).
4. Documentos do caso (`Document`).
5. Fundamentos pinados (`ApprovedLegalFoundation`).
6. Peças aprovadas do escritório.
7. Memória do escritório opt-in (`OfficeMemory`).
8. Modelos / templates internos (`InterviewTemplate`).
9. Inferência IA.
10. Heurística.
11. Fallback LLM.

Inclui **matriz de capacidade** por nível (pode citar / fundamentar / sobrescrever / exige validação / exige revisão / pode entrar em memória/busca indexada/cliente/export); **12 regras absolutas** ("IA nunca é fonte primária", "base ausente = lacuna nunca fundamento", etc); diferenciação operacional explícita entre `LegalSource` (DROPPED), `LegalNorm`, `LegalChunk`, `CaseLegalSource`, `ApprovedLegalFoundation`, `Document`, `OfficeMemory`, `InterviewTemplate`; distinção `AI_REASONING ≠ LEGAL_TRUTH`.

**Lacuna anterior fechada**: docs antigas (e até README) ainda referenciam `LegalSource` e confundem `CaseLegalSource` com norma; gates G-58/S-03 mencionavam "fundamento inventado" sem definir hierarquia oficial. Agora há **um** documento canônico para "o que é fonte".

### 2.4 [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md) — 316 linhas

**Resolve**: regras de ordem dispersas em texto solto na `PRIORITY_MATRIX.md`. Formaliza **20 regras** (15 canônicas + 5 complementares) com schema de 9 campos (id, regra, motivo, risco, exceção, aprovação, doc, stop condition, gate). Cobre P3/P4 antes de P0/P1, marketplace, landing pages, email/nuvem própria, integrações tribunais live, WhatsApp live, multi-model, troca de embedding/chunker/prompts, venda de Pro/Enterprise com P0 partial, jurimetria sem fonte, integração com tribunais sem matriz, admin gating, promessa de feature `planned` sem rótulo, API pública, SSO, billing, bulk export, voz/áudio.

Inclui diagrama mermaid de dependências executivas.

**Lacuna anterior fechada**: PRIORITY_MATRIX §3 listava 10 forbidden orderings em texto livre; agora cada uma é um item bloqueante com aprovações claras + stop condition vinculada.

### 2.5 [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md) — 485 linhas

**Resolve**: ausência de **limites operacionais**. Define **32 budgets** em 5 dimensões:

- A — Parallelism (7): features paralelas, refactors, migrations, subsystems Tier-S, mudanças retrieval/embedding/chunker, PRs P0, PRs P3/P4 enquanto P0/P1 partial.
- B — Cost (10): IA por workspace/dia/caso/peça, embedding reindex, storage, Qdrant, DeepInfra, Vercel+Supabase, WhatsApp futuro, DataJud futuro.
- C — Window (6): stabilization week (a cada 4), freeze window (5 dias antes de release), benchmark cycle (8 semanas), hardening cycle (12 semanas), debt reduction (2 dias/sprint), no-new-feature period (automático com S-*).
- D — Architecture (5): regras duras de `ARCHITECTURE_STABILITY_POLICY` (stack, embedding, chunker, schema, API).
- E — Enforcement (4): block-merge, block-promote, override, board review.

Cada budget tem MVP/Pro/Enterprise + `interim_rule` + medição + enforcement + owner. **Honestidade**: 22 de 32 budgets estão `baseline_status: unknown`; ativam-se como `interim` agora, viram `enforced` após 30 dias de medição (regra §8).

**Lacuna anterior fechada**: Leva 1 falava em "EXECUTION_BUDGETS" referenciado mas o doc não existia. Sem isso, os limites de §6 do `EXECUTION_GOVERNANCE` (1 refactor/sprint, 2 features paralelas, etc.) eram texto solto sem aplicação.

### 2.6 [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md) — 431 linhas

**Resolve**: tendência natural de "vamos refatorar/trocar". Define **45 políticas** em 8 áreas:

- A — Stack core (4): Next.js/Prisma/Supabase/Qdrant/Redis/Inngest/DeepInfra/DeepSeek/Vercel + regras leves vs fortes.
- B — Retrieval (5): Qdrant cluster/coleção, metadata, hybrid search, rerank, query expansion.
- C — Embeddings (6): troca de modelo, dimensão, coexistência, reindex, custo, rollback.
- D — Chunking (5): mudança de chunker, parent/child, article/inciso/parágrafo, validação semântica, replay.
- E — Schema/API (5): compatibility layer, versionamento, deprecations, drop N+2, backward compatibility.
- F — UX core (7): intake, case page, library, research, drafting, review, export.
- G — Prompts (5): versionamento, registry (planejado), benchmark adversarial, rollback, monitoramento.
- H — Anti-chaos (8): proibir reescrita, refactor casual, mudança por preferência, abstração prematura, enterprise prematuro, microservicizar prematuro, redesign UI sem RFC, "tooling-first".

**Lacuna anterior fechada**: Leva 1 referenciava "ARCHITECTURE_STABILITY_POLICY" mas o doc não existia. Sem ele, troca de embedding/chunker/prompt era "vamos com calma" sem regra. Agora cada mudança tem evidência obrigatória + sign-off + rollback explícito.

### 2.7 [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) — 662 linhas

**Resolve**: gates referenciavam scripts mas sem **estrutura de gold-set**, **cadência** e **política de baseline**. Define **6 suítes**:

- A — Retrieval (8 benchmarks: CF/88, legislação geral, documentos de caso, biblioteca, query vaga, técnica, com artigo, com caso contextual).
- B — Legal QA adversarial (7: fundamento inventado, artigo errado, ADCT irrelevante, citação truncada, jurisprudência ausente, base ausente, conflito de norma).
- C — Drafting (7: relato incompleto, com comandos, caso com documento, sem fundamento, urgência, peça bloqueada, exportável).
- D — UX/workflow (8: criar caso, entrevista guiada, enviar doc, pesquisar, pinar, gerar peça, revisar, exportar).
- E — Security (6: IDOR, workspaceId scoping, admin gating, logs PII, export cross-tenant, storage unauthorized).
- F — Cost/Performance (5: latência, custo por query/peça, spike, fallback rate).

Cada benchmark tem 10 campos (id, nome, objetivo, fixture, comando, métrica, threshold, owner, frequência, gate/stop). Inclui **6 gold-sets** mínimos (CF/88, códigos, jurisprudência, adversarial, casos, security), **regression suite por release** (~30–45 min), **policy de baseline update**, **anti-trapaça** (não ajustar baseline para parecer ok), **cadência** (release / 8sem / 12sem / trimestral / semestral) e **dashboard futuro** planejado para F1/F2.

**Lacuna anterior fechada**: scripts em `package.json` (`cf-retrieval-smoke`, `qa:retrieval:domains`, etc.) eram a "regression suite v0" sem cadência institucional ou gold-set publicado. Agora há plano formal.

---

## 3. O que ainda depende de F0

> Itens que **só podem fechar** com auditoria detalhada e medição em ambiente real.

### 3.1 Medições

- **42 de 44 métricas** em [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) estão `baseline_status: unknown`. F0 mede.
- **22 de 32 budgets** em [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md) estão `baseline_status: unknown`. F0 mede.
- **6 gold-sets** em [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) §9 ainda não publicados formalmente; F0 popula.

### 3.2 Auditorias

- **RBAC server-side**: produzir `docs/security/RBAC_COVERAGE_MATRIX.md` (ver Leva 1 §5.7). Sem isso, gate G-19 e stop S-13 ficam textuais.
- **Multi-tenant scoping**: confirmar `workspaceId` em todas as queries críticas.
- **PII em logs**: rodar Suíte E-04 manual com amostra real.
- **Cobertura de tribunais**: publicar `docs/integrations/TRIBUNALS_COVERAGE.md` (`F-O-13`).
- **DataJud**: documentar estado real (`F-O-13`).
- **STJ provider**: confirmar status (scaffold vs live), atualizar `PRIORITY_MATRIX §4`.

### 3.3 Correções (Leva 1 §4–§8)

> Esta Leva **não corrigiu nada**. Lista resumida do que F0 deve corrigir:

- README: redirects fantasma (`/biblioteca`, `/retrieval`); referência a `LegalSource` após DROP; scripts ausentes (`ingest:corpus`, `seed:demo-legal`); `vercel.json` sem cron prometido; `src/lib/repositories` inexistente; smoke flow `/processos` × jornada `/cases`.
- `MASTER_INDEX.md` ausente.
- Audits P0 já existentes não indexados pelo plano.
- `COLBERT_LEGAL_RETRIEVAL.md` vs realidade do pipeline.
- LGPD doc + DPA pendentes.

### 3.4 Documentos planejados na Leva 2 mas que vivem em outras pastas (não nesta Leva)

- `docs/governance/INCIDENT_LOG.md` (vazio até primeiro incidente; criar template em F1).
- `docs/governance/POSTMORTEM_TEMPLATE.md` (criar em F1).
- `docs/governance/OVERRIDES_LOG.md` (vazio até primeiro override).
- `docs/governance/STOP_LEDGER.md` (estado das stop conditions; criar em F1).
- `docs/governance/HEALTH_METRICS.md` (mensal; primeira em F1).
- `docs/governance/THRESHOLDS_LEDGER.md` (criar quando primeira métrica virar `enforced`).
- `docs/governance/BUDGETS_LEDGER.md` (idem).
- `docs/benchmarks/<gold-set-id>.md` (em F0).
- `docs/benchmarks/baselines/<YYYY-MM-DD>.md` (em F0/F1).
- `.github/PULL_REQUEST_TEMPLATE.md` (em F6).

---

## 4. Gaps remanescentes

| ID | Gap | Severidade | Onde resolver |
|----|-----|------------|---------------|
| GAP-01 | OWNER_MATRIX com nomes ainda vazios | Alta | preencher antes de F0 |
| GAP-02 | Governance sem assinaturas (PO + CTO + Legal + Security + QA) | Alta | sign-off antes de F0 |
| GAP-03 | Sem instrumentação para medir Suíte F (latência, fallback, custo) em produção | Alta | F1/F2 |
| GAP-04 | Gold-sets formais ausentes (§9 do `BENCHMARK_STRATEGY.md`) | Alta | F0 |
| GAP-05 | Bot de PR + CI gates ainda não implementados | Média | F6 |
| GAP-06 | `MASTER_ROADMAP.md` (versão pública das Fases F0..F10) ainda não publicado | Média | F0/F1 |
| GAP-07 | `MASTER_INDEX.md` consolidando docs ausente | Média | F1 |
| GAP-08 | `DOC_VS_CODE_DIVERGENCE.md` formal ainda não criado (Leva 1 § funciona como insumo) | Média | F0 |
| GAP-09 | Prompt registry centralizado (A-G-02) inexistente | Baixa | F2 |
| GAP-10 | Dashboard de benchmarks (BENCHMARK §14) inexistente | Baixa | F1/F2 |

---

## 5. Thresholds ainda `unknown` (resumo)

> Lista oficial. **Não bloqueiam release** até F0/F2 medirem; até lá vale `interim_rule` conservadora.

### Suíte A — Retrieval
- Q-A-01 hits@1; Q-A-02 hits@3; Q-A-03 hits@5; Q-A-04 MRR; Q-A-05 cobertura por domínio (parcial); Q-A-06 queries sem resposta; Q-A-07 fallback rate; Q-A-08 chunks irrelevantes top-5.

### Suíte B — Grounding
- Q-B-02 mediano; Q-B-03 % com fonte citável; Q-B-04 citation accuracy; Q-B-05 source existence (regra dura, mas sem medição contínua); Q-B-06 source text match.
  - **Conhecido**: Q-B-01 = 0.45 (configuração).

### Suíte C — Legal quality
- Q-C-01 hallucination rate; Q-C-02 unsupported claim; Q-C-03 wrong article; Q-C-04 ADCT irrelevante; Q-C-05 normative mismatch; Q-C-06 procedural incoherence; Q-C-07 drafting blocker rate.

### Suíte D — Drafting
- Q-D-01 placeholder (regra dura, sem medição contínua); Q-D-02..Q-D-06 todos `unknown`.

### Suíte E — UX
- Q-E-01 completion rate; Q-E-02 dead-end; Q-E-03 loading/empty/error coverage; Q-E-04 tempo até próxima ação.

### Suíte F — Performance
- Q-F-01..Q-F-08 todos `unknown`.

### Suíte G — Cost
- Q-G-01..Q-G-05 todos `unknown`.

**Total**: 42 métricas `unknown` + 2 `known`/regra dura sem medição contínua.

---

## 6. Budgets ainda `interim` (resumo)

### Suíte A — Parallelism
- B-A-01..B-A-06 `interim`/`unknown`; **B-A-07 `known`** (regra dura: 0 PRs P3/P4 enquanto P0/P1 partial).

### Suíte B — Cost
- B-B-01..B-B-10 todos `unknown`/`interim`.

### Suíte C — Window
- B-C-01..B-C-05 `interim` (não institucionalizado); **B-C-06 `known`** (no-new-feature automático com S-*).

### Suíte D — Architecture
- B-D-01..B-D-05 todos `known` (regras duras herdadas de `ARCHITECTURE_STABILITY_POLICY`).

### Suíte E — Enforcement
- 4 regras de aplicação (não são budgets numéricos).

**Total**: 22 `interim`/`unknown` + 10 `known`.

---

## 7. Forbidden orderings que **bloqueiam** P3/P4 hoje

Aplicação imediata, todos relacionados ao estado atual em Survival Mode:

- **F-O-01** — P3/P4 antes de P0/P1 atingirem thresholds → **bloqueio total** enquanto Suítes A/B/C estão `unknown`.
- **F-O-02** — Marketplace antes de quality engine + biblioteca + memória maduros.
- **F-O-03** — Landing pages builder antes de UX comercial + intake + CRM.
- **F-O-04** — Email/nuvem própria antes de pacote security + LGPD.
- **F-O-05** — Tribunais live antes de mock + secrets + LGPD.
- **F-O-06** — WhatsApp live antes de LGPD + opt-in.
- **F-O-07** — Multi-model orchestration antes de retrieval estável (Suíte A/B em MVP por 30 dias).
- **F-O-08** — Trocar embedding sem benchmark + rollback.
- **F-O-09** — Trocar chunker sem corpus validation + replay.
- **F-O-10** — Mudar prompts de drafting sem benchmark adversarial.
- **F-O-11** — Vender Pro/Enterprise com P0 `partial` (estado atual).
- **F-O-12** — "Jurimetria" sem fonte/metodologia.
- **F-O-13** — "Integração com todos os tribunais" sem matriz pública.
- **F-O-14** — Admin/Jobs/Observability para usuário comum.
- **F-O-15** — Promover feature `planned` sem rotular.
- **F-O-16** — API pública antes de quality engine + billing + LGPD.
- **F-O-17** — SSO/SAML/SCIM antes de RBAC server-side maduro.
- **F-O-18** — Billing antes de pricing + cap de custo IA.
- **F-O-19** — Bulk export antes de auditoria LGPD.
- **F-O-20** — Voz/áudio antes de PII redaction + LGPD.

**Conclusão operacional**: hoje, **nenhum P3/P4 deve estar em desenvolvimento**. Sprint backlog deve refletir isso.

---

## 8. Documentos que precisam de assinatura (sign-off antes de F0)

Antes de F0 começar, **5 papéis** devem assinar §13 do [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md), confirmando leitura e adesão a:

1. [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) (Leva 1)
2. [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md) (Leva 1)
3. [`OWNER_MATRIX.md`](OWNER_MATRIX.md) (Leva 1) — **com nomes preenchidos**
4. [`RELEASE_GATES.md`](RELEASE_GATES.md) (Leva 1)
5. [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) (Leva 1)
6. [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md) (Leva 1)
7. [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md) (Leva 1)
8. [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md) (Leva 2)
9. [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) (Leva 2)
10. [`TRUTH_HIERARCHY.md`](TRUTH_HIERARCHY.md) (Leva 2)
11. [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md) (Leva 2)
12. [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md) (Leva 2)
13. [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md) (Leva 2)
14. [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) (Leva 2)

**Sem essas 5 assinaturas + nomes em `OWNER_MATRIX`**, F0 **não começa** (regra dura do plano v3.2 + `EXECUTION_GOVERNANCE` §13).

---

## 9. Recomendação clara

> **Atualização 2026-05-10**: esta seção foi **superada** pelo Checkpoint de Sign-off em §11. As condições "OWNER_MATRIX preenchido" e "assinaturas em §13" foram **resolvidas provisoriamente**. Mantida abaixo como histórico do estado pré-checkpoint.

### 9.1 F0 pode iniciar? (estado pré-checkpoint, **superado** — ver §11)

**Não — ainda não.** Apesar da camada documental de governance estar completa (Leva 1 + Leva 2), faltam **2 condições obrigatórias**:

| Condição | Status | Bloqueia F0? |
|----------|--------|:------------:|
| 15 docs de governance criados | ✓ feito (Leva 1 + Leva 2) | — |
| OWNER_MATRIX preenchido com nomes reais | pendente (todas as células `_a preencher_`) | **sim** |
| 5 assinaturas em `EXECUTION_GOVERNANCE.md` §13 | pendente | **sim** |
| Inconsistências da Leva 1 §4–§8 corrigidas | NÃO — proibido pelo escopo desta Leva | não bloqueia (são tarefas de F0) |
| Baselines medidos | NÃO — proibido pelo escopo desta Leva | não bloqueia (são tarefas de F0) |

### 9.2 Próxima ação recomendada (estado pré-checkpoint, **superado** — ver §11)

1. **PO + CTO**: preencher [`OWNER_MATRIX.md`](OWNER_MATRIX.md) com nomes reais (todas as células `_a preencher_`). Bus factor mínimo 2 em Tier-S/A.
2. **PO + CTO + Legal Lead + Security Lead + QA Lead**: ler os 14 docs e assinar §13 do [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) (commit hash do PR de aprovação por papel).
3. **Decidir explicitamente**: iniciar F0 — **Auditoria** (escopo: corrigir Leva 1 §4–§8 + medir baselines + popular gold-sets §9 do `BENCHMARK_STRATEGY` + publicar `MASTER_INDEX.md`, `MASTER_ROADMAP.md`, `DOC_VS_CODE_DIVERGENCE.md`).
4. **Não anunciar** publicamente ou prometer features `planned`/`partial` (`F-O-11`, `F-O-15`).
5. **Instituir cadência operacional** §6 do `EXECUTION_GOVERNANCE.md` no próximo sprint (mesmo sem instrumentação ainda — planilhas servem).

### 9.3 Resumo executivo pré-checkpoint (1 frase, **superado** — ver §11.6)

> **Não inicie F0 enquanto OWNER_MATRIX estiver com `_a preencher_` e governance não estiver assinada.** Com nomes + assinaturas, F0 começa imediatamente com escopo definido e proibições claras (15 forbidden orderings + 11 níveis de hierarquia + 44 thresholds + 32 budgets + 45 políticas de estabilidade + 41 benchmarks).

---

## 10. Apêndice — Estrutura final de `docs/governance/` após Leva 2 + Checkpoint de Sign-off

```
docs/governance/
├── EXECUTION_GOVERNANCE.md            (Leva 1)        ✓ — §13 assinado provisoriamente em 2026-05-10
├── PRIORITY_MATRIX.md                 (Leva 1)        ✓
├── OWNER_MATRIX.md                    (Leva 1)        ✓ — preenchido provisoriamente em 2026-05-10 (§0 roster)
├── RELEASE_GATES.md                   (Leva 1)        ✓
├── DEFINITION_OF_DONE.md              (Leva 1)        ✓
├── STOP_CONDITIONS.md                 (Leva 1)        ✓
├── ROLLBACK_POLICY.md                 (Leva 1)        ✓
├── EXECUTION_REPORT_F-1_LEVA_1.md     (Leva 1)        ✓
│
├── PRODUCT_SURVIVAL_MODE.md           (Leva 2)        ✓
├── QUALITY_THRESHOLDS.md              (Leva 2)        ✓
├── TRUTH_HIERARCHY.md                 (Leva 2)        ✓
├── FORBIDDEN_ORDERINGS.md             (Leva 2)        ✓
├── EXECUTION_BUDGETS.md               (Leva 2)        ✓
├── ARCHITECTURE_STABILITY_POLICY.md   (Leva 2)        ✓
├── BENCHMARK_STRATEGY.md              (Leva 2)        ✓
├── EXECUTION_REPORT_F-1_LEVA_2.md     (Leva 2)        ✓ ← este relatório (atualizado em 2026-05-10 com §11)
│
├── F-1_SIGNOFF.md                     (Checkpoint)    ✓ — criado em 2026-05-10
│
├── INCIDENT_LOG.md                    (F1)            pendente
├── POSTMORTEM_TEMPLATE.md             (F1)            pendente
├── OVERRIDES_LOG.md                   (vazio)         pendente
├── STOP_LEDGER.md                     (F1)            pendente
├── HEALTH_METRICS.md                  (F1)            pendente
├── THRESHOLDS_LEDGER.md               (vazio)         pendente
└── BUDGETS_LEDGER.md                  (vazio)         pendente
```

> **Total atual**: 17 documentos (Leva 1 + Leva 2 + 2 reports + F-1_SIGNOFF). Iniciar F0 com escopo restrito está autorizado conforme §11 (checkpoint).

---

## 11. Checkpoint de Sign-off (2026-05-10)

> **Substitui §9** como recomendação canônica. Espelha [`F-1_SIGNOFF.md`](F-1_SIGNOFF.md), o documento oficial do checkpoint.

### 11.1 OWNER_MATRIX preenchido

- [`OWNER_MATRIX.md`](OWNER_MATRIX.md) **reescrito** em 2026-05-10:
  - **§0 — Roster funcional provisório**: 5 aliases (`Thales (PO)`, `Thales/Cursor (CTO interim)`, `Legal Lead [PROVISÓRIO]`, `Security Lead [PROVISÓRIO]`, `QA Lead [PROVISÓRIO]`).
  - **§3 — 25 subsystems**: todas as **8 células** de cada subsystem Tier-S e Tier-A preenchidas (`owner_principal`, `owner_secundario`, `reviewer_obrigatorio`, `approval_chain`, `criticidade`, `dependencias`, `autoridade_rollback`, `autoridade_freeze`). Tier-B e Tier-C preenchidas em formato compacto.
  - **§4.6 — Conflito de papéis**: registrado que equipe < 5 e há acúmulos declarados.
  - **§7 + §8 — Como aplicar / Notas operacionais**: descrevem o que pode e o que não pode acontecer enquanto provisórios existirem.
- **Zero `_a preencher_`** em campo de papel (a única ocorrência restante é em texto explicativo, descrevendo o estado anterior).
- **Bus factor humano** = 1 em todos os Tier-S/A. Reconhecido honestamente como dívida de governance, **não escondido**.

### 11.2 Governança assinada

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) **§13** atualizada em 2026-05-10:
  - **PO de Produto**: Thales — sign-off **definitivo**.
  - **CTO / Tech Lead**: Thales + Cursor agent (CTO interim) — sign-off **provisório**.
  - **Legal Lead**: sign-off **adiado** (papel provisório); F0 prossegue com escopo interno.
  - **Security Lead**: sign-off **adiado** (papel provisório); F0 prossegue com escopo interno.
  - **QA / Benchmark Lead**: sign-off **adiado** (papel provisório); F0 prossegue com escopo interno.
- **Regra atualizada**: assinatura provisória **vale** para destravar **F0 interno**; **não vale** para gate G-62 (release público).

### 11.3 Papéis provisórios (resumo)

| Papel | Status | Substituição obrigatória antes de |
|-------|--------|-----------------------------------|
| PO de Produto (Thales) | **DEFINITIVO** | — |
| CTO / Tech Lead (Thales/Cursor interim) | **PROVISÓRIO** | release público pago |
| Legal Lead | **PROVISÓRIO** | LGPD doc/DPA, tribunais live, WhatsApp/email/voz live, vendas Pro/Enterprise, qualquer release público |
| Security Lead | **PROVISÓRIO** | SSO/SAML/SCIM, bulk export, integrações live, qualquer release público |
| QA / Benchmark Lead | **PROVISÓRIO** | promover threshold `interim` → `enforced`, mudar Tier-S em retrieval/embedding/chunker/IA prompt, qualquer release público |

Detalhe de cada provisório em [`F-1_SIGNOFF.md`](F-1_SIGNOFF.md) §4.

### 11.4 Pendências antes de produção pública

> Estas pendências **não bloqueiam F0 interno**, mas **bloqueiam** promoção a produção pública (gate G-62 + DoD-19 + restrições do `PRODUCT_SURVIVAL_MODE.md`).

1. Substituir os **4 papéis provisórios** por humanos nomeados.
2. Atualizar [`OWNER_MATRIX.md`](OWNER_MATRIX.md) **§0 + §3** com nomes reais; zero `[PROVISÓRIO]` em Tier-S/A.
3. Refazer [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §13 com **5 assinaturas humanas** (commit hash do PR de aprovação por papel) substituindo as linhas provisórias.
4. Tratar inconsistências da [`EXECUTION_REPORT_F-1_LEVA_1.md`](EXECUTION_REPORT_F-1_LEVA_1.md) §4–§8 (8 S-ALT + 13 S-MED + 3 S-BAI). É escopo de F0.
5. Medir **42 das 44 métricas** ainda `unknown` em [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md). É escopo de F0/F1.
6. Definir **22 dos 32 budgets** ainda `unknown` em [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md). É escopo de F0/F1.
7. Popular **6 gold-sets** em [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) §9. É escopo de F0/F1.
8. Publicar `MASTER_INDEX.md`, `MASTER_ROADMAP.md`, `DOC_VS_CODE_DIVERGENCE.md`, `docs/security/RBAC_COVERAGE_MATRIX.md`. É escopo de F0.
9. Instituir cadência operacional §6 de [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) (planning, daily quality check, RFC review, retrospective) no próximo sprint.
10. Encerrar Survival Mode segundo critérios §10 de [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md) (10 sinais simultâneos).

### 11.5 Decisão: F0 autorizada?

**Sim — F0 — Auditoria está autorizada a iniciar com escopo restrito.**

- **Escopo autorizado**: trabalho interno de auditoria, correção documental, medição de baselines, instituição de templates de governance operacional. Detalhe em [`F-1_SIGNOFF.md`](F-1_SIGNOFF.md) §5.2.
- **Escopo NÃO autorizado** (mantém-se bloqueado): qualquer promoção a produção pública; qualquer mudança em embedding/chunker/prompt; live de tribunais; live de WhatsApp/email/voz; SSO/SAML/SCIM; bulk export; vendas Pro/Enterprise; promoção de threshold `interim` → `enforced` sem QA Lead nomeado. Detalhe em [`F-1_SIGNOFF.md`](F-1_SIGNOFF.md) §5.3.
- **Checkpoints obrigatórios após F0**: (a) **Checkpoint F0 → F1** com novo sign-off; (b) **Checkpoint produção pública** exigindo 5 assinaturas humanas reais e zero `[PROVISÓRIO]` em Tier-S/A.

### 11.6 Resumo executivo (1 frase)

> **F-1 fechada com sign-off provisório; F0 autorizada para escopo interno sob restrições; promoção a produção pública continua bloqueada até substituição dos 4 papéis provisórios por humanos nomeados.**

---

## Veja também

- [`F-1_SIGNOFF.md`](F-1_SIGNOFF.md) — documento oficial do checkpoint (espelhado em §11).
- [`OWNER_MATRIX.md`](OWNER_MATRIX.md) — roster §0, restrições §0, notas §8.
- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §13 — assinatura provisória registrada.
- [`EXECUTION_REPORT_F-1_LEVA_1.md`](EXECUTION_REPORT_F-1_LEVA_1.md) — relatório da Leva 1 com inconsistências detalhadas (a tratar em F0).
- Plano mestre v3.2: `/home/thales/.cursor/plans/lex_master_documentation_plan_9a6a48df.plan.md`.
