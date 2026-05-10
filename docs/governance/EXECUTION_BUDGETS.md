---
title: Execution Budgets — Lex
status: reviewed
owners: [PO, CTO]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/PRIORITY_MATRIX.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/FORBIDDEN_ORDERINGS.md
  - docs/governance/ARCHITECTURE_STABILITY_POLICY.md
tier: mvp
---

# Execution Budgets — Lex

> **Documento canônico de limites operacionais.** Define quantas coisas podem acontecer **em paralelo**, quanto pode custar, em que janela, e o que dispara override / freeze. Sem orçamento explícito, "tudo é prioridade" — e nada termina.
>
> **Honestidade**: muitos números aqui são `interim_rule` (default conservador) porque o produto ainda não foi medido em produção. Promoção para `enforced` segue mesma regra de [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) §10.

---

## 1. Schema de cada budget

| Campo | Definição |
|-------|-----------|
| `id` | identificador estável (`B-XX-NN`) |
| `dimensao` | parallelism / cost / window / architecture / enforcement |
| `descricao` | o que limita |
| `mvp_limit` | limite ativo em Survival Mode (vide `PRODUCT_SURVIVAL_MODE.md`) |
| `pro_limit` | limite quando produto sair de Survival Mode |
| `enterprise_limit` | limite com time + cliente enterprise validados |
| `baseline_status` | `known` \| `partial` \| `unknown` |
| `interim_rule` | regra padrão até medir |
| `medicao` | como medir hoje |
| `enforcement` | bloqueia merge / promote / exige override / board review |
| `owner` | papel responsável |

---

## 2. Suíte A — Limites por sprint (parallelism)

> Sprint padrão = **2 semanas** (`EXECUTION_GOVERNANCE.md` §6).

### B-A-01 — Máximo de features paralelas em desenvolvimento

- **descricao**: features (RFC aprovada) abertas em PRs simultâneos do time.
- **mvp_limit**: **3** features paralelas (Survival Mode).
- **pro_limit**: 5.
- **enterprise_limit**: 8.
- **baseline_status**: `unknown` (não há contagem histórica registrada).
- **interim_rule**: 3 features máximo até medir capacidade real.
- **medicao**: contagem semanal de PRs abertos com label `feature` ou `tier:P0..P4`.
- **enforcement**: `block-merge` se exceder; abre fila visível.
- **owner**: PO + CTO.

### B-A-02 — Máximo de refactors simultâneos

- **descricao**: refactors técnicos (sem mudança de comportamento) abertos.
- **mvp_limit**: **1** refactor por vez.
- **pro_limit**: 2.
- **enterprise_limit**: 3.
- **baseline_status**: `unknown`.
- **interim_rule**: 1 refactor máximo; depende de janela `hardening cycle` (B-C-04).
- **medicao**: contagem de PRs com label `refactor`.
- **enforcement**: `block-merge`.
- **owner**: CTO.

### B-A-03 — Máximo de migrations Prisma por sprint

- **descricao**: novas migrations em `prisma/migrations/**` por sprint.
- **mvp_limit**: **2** migrations por sprint.
- **pro_limit**: 4.
- **enterprise_limit**: 6.
- **baseline_status**: `partial` (histórico recente: 2026-05-09 com 13 migrations em 3 dias — fora do limite, condizente com fase de scaffold).
- **interim_rule**: 2 por sprint a partir do próximo sprint; toda migration acima exige RFC + CTO + banco owner.
- **medicao**: `git log -- prisma/migrations | wc -l` por janela.
- **enforcement**: `block-merge` se exceder; cada migration deve ser **backwards-compatible** (DoD-03).
- **owner**: banco owner + CTO.

### B-A-04 — Máximo de subsystems Tier-S tocados por sprint

- **descricao**: subsystems Tier-S (ver `OWNER_MATRIX.md` §3) modificados em PRs do mesmo sprint.
- **mvp_limit**: **2** Tier-S simultâneos.
- **pro_limit**: 3.
- **enterprise_limit**: 4.
- **baseline_status**: `unknown`.
- **interim_rule**: 2 máximo; PR que toque subsystem Tier-S declara isso no template.
- **medicao**: PR template + `OWNER_MATRIX` lookup.
- **enforcement**: `block-merge` se 3º subsystem Tier-S é tocado.
- **owner**: CTO.

### B-A-05 — Máximo de mudanças retrieval/embedding/chunker por sprint

- **descricao**: PRs que tocam `src/lib/retrieval/**`, `src/lib/corpus/{embeddings*,legal-chunker*}` por sprint.
- **mvp_limit**: **1** mudança por sprint.
- **pro_limit**: 2.
- **enterprise_limit**: 3 (com cycles de benchmark dedicados).
- **baseline_status**: `unknown`.
- **interim_rule**: 1; mudança extra exige RFC + benchmark obrigatório (`BENCHMARK_STRATEGY.md` §A).
- **medicao**: grep nos paths via PR diff.
- **enforcement**: `block-merge` se 2ª mudança no sprint.
- **owner**: retrieval owner + QA Lead.

### B-A-06 — Máximo de PRs P0 abertas

- **descricao**: PRs classificadas P0 abertas simultaneamente.
- **mvp_limit**: **5** PRs P0 abertas (Survival Mode prioriza P0).
- **pro_limit**: 7.
- **enterprise_limit**: 10.
- **baseline_status**: `unknown`.
- **interim_rule**: 5; se exceder, novas PRs P0 entram em fila.
- **medicao**: contagem de PRs com label `tier:P0`.
- **enforcement**: alerta + freeze de novas P0 até reduzir.
- **owner**: PO.

### B-A-07 — Máximo de PRs P3/P4 enquanto algum P0/P1 estiver `partial`

- **descricao**: PRs P3 ou P4 abertas enquanto há features P0/P1 em estado `partial` ou `pending`.
- **mvp_limit**: **0** (vide `FORBIDDEN_ORDERINGS.md F-O-01`).
- **pro_limit**: 1 (com aprovação dupla PO + CTO).
- **enterprise_limit**: 2.
- **baseline_status**: `known` (regra dura).
- **interim_rule**: 0 enquanto Survival Mode ativo.
- **medicao**: `PRIORITY_MATRIX.md` §4 cruzado com label do PR.
- **enforcement**: `block-merge`.
- **owner**: PO + CTO.

---

## 3. Suíte B — Limites de custo

> Valores em USD aproximados; revisão trimestral. Quando `baseline_status: unknown`, usar `interim_rule` e medir em F0/F2.

### B-B-01 — Custo IA por workspace por dia

- **descricao**: gasto IA acumulado por workspace por dia (DeepSeek + DeepInfra).
- **mvp_limit**: **soft $25/dia/workspace, hard $40** (alerta + freeze de chamadas custosas no hard).
- **pro_limit**: soft $15, hard $25.
- **enterprise_limit**: definido por contrato.
- **baseline_status**: `unknown`.
- **interim_rule**: cap soft em $25 a partir do dia em que instrumentar Langfuse cost.
- **medicao**: Langfuse + agregação por `workspaceId/day`.
- **enforcement**: alerta soft → notifica IA owner; hard → `dispatch-stop` (S-05).
- **owner**: IA owner + CTO.

### B-B-02 — Custo IA por caso

- **descricao**: ver Q-G-03.
- **mvp_limit**: ≤ $3.00 / caso (mediana).
- **pro_limit**: ≤ $2.00.
- **enterprise_limit**: ≤ $1.20.
- **baseline_status**: `unknown`.
- **interim_rule**: alerta acima de $3.00.
- **medicao**: agregação por `caseId`.
- **enforcement**: `dispatch-stop` (S-05).
- **owner**: IA owner.

### B-B-03 — Custo IA por peça

- **descricao**: ver Q-G-02.
- **mvp_limit**: ≤ $0.40 / peça.
- **pro_limit**: ≤ $0.25.
- **enterprise_limit**: ≤ $0.15.
- **baseline_status**: `unknown`.
- **interim_rule**: alerta acima de $0.40.
- **medicao**: agregação por `draftId`.
- **enforcement**: `dispatch-stop` (S-05).
- **owner**: IA owner.

### B-B-04 — Custo embedding por reindex completo

- **descricao**: custo de uma reindexação total do corpus oficial (CF/88 + códigos críticos + jurisprudência).
- **mvp_limit**: ≤ **$120** por reindex.
- **pro_limit**: ≤ $80.
- **enterprise_limit**: ≤ $50 (com batches otimizados).
- **baseline_status**: `unknown`.
- **interim_rule**: estimativa antes de cada reindex; abortar se estimativa > $200.
- **medicao**: throttle pipeline + log de tokens.
- **enforcement**: requer aprovação CTO + IA owner.
- **owner**: IA owner + CTO.

### B-B-05 — Custo storage por workspace

- **descricao**: armazenamento Supabase Storage por workspace.
- **mvp_limit**: ≤ **5 GB** por workspace (hard).
- **pro_limit**: ≤ 25 GB.
- **enterprise_limit**: definido por contrato.
- **baseline_status**: `unknown`.
- **interim_rule**: alerta acima de 5 GB.
- **medicao**: query Supabase por bucket `documents`.
- **enforcement**: alerta + UX para arquivar.
- **owner**: documentos owner + CTO.

### B-B-06 — Custo Qdrant (cloud)

- **descricao**: custo mensal Qdrant.
- **mvp_limit**: ≤ **$120/mês** (cluster atual single tenant).
- **pro_limit**: ≤ $400/mês.
- **enterprise_limit**: definido por SLA.
- **baseline_status**: `unknown` (não publicado).
- **interim_rule**: alerta acima do esperado mensal.
- **medicao**: painel Qdrant Cloud.
- **enforcement**: revisão CTO; se sustentado >2 meses, considerar reindex/optimization.
- **owner**: infra owner + retrieval owner.

### B-B-07 — Custo DeepInfra (embeddings + reranker)

- **descricao**: custo mensal DeepInfra.
- **mvp_limit**: ≤ **$200/mês** (estimativa atual).
- **pro_limit**: ≤ $700/mês.
- **enterprise_limit**: definido por SLA.
- **baseline_status**: `unknown`.
- **interim_rule**: alerta acima do esperado.
- **medicao**: painel DeepInfra.
- **enforcement**: revisão CTO + IA owner.
- **owner**: IA owner.

### B-B-08 — Custo Vercel + Supabase

- **descricao**: custo somado mensal Vercel + Supabase (db + auth + storage).
- **mvp_limit**: ≤ **$250/mês**.
- **pro_limit**: ≤ $700/mês.
- **enterprise_limit**: definido por SLA.
- **baseline_status**: `unknown`.
- **interim_rule**: revisão mensal por CTO.
- **medicao**: faturas + painéis.
- **enforcement**: revisão CTO; otimização (cold start / edge cache / RLS) antes de upgrade de plano.
- **owner**: infra owner + CTO.

### B-B-09 — Custo WhatsApp futuro (Twilio / WhatsApp Cloud API)

- **descricao**: custo por mensagem; cap por workspace.
- **mvp_limit**: feature **congelada** (`F-O-06`); cap só ativo quando live.
- **pro_limit**: cap default $0.05/msg; alerta acima de $30/dia/workspace.
- **enterprise_limit**: definido por contrato.
- **baseline_status**: `unknown`.
- **interim_rule**: bloqueio total enquanto não LGPD-compliant.
- **medicao**: painel provider.
- **enforcement**: `block-merge` para PRs que liguem live sem aprovação.
- **owner**: integrações owner + Legal Lead.

### B-B-10 — Custo DataJud / tribunal futuro

- **descricao**: custo por consulta CNJ (DataJud) e similares quando live.
- **mvp_limit**: feature em **scaffold**; cap só ativo quando live.
- **pro_limit**: cap soft 1k consultas/dia/workspace; hard 5k.
- **enterprise_limit**: definido por contrato.
- **baseline_status**: `unknown`.
- **interim_rule**: bloqueio em produção sem matriz de cobertura publicada (`F-O-13`).
- **medicao**: log do adapter.
- **enforcement**: alerta + `dispatch-stop`.
- **owner**: integrações owner.

---

## 4. Suíte C — Janelas operacionais

> Convenção: janela = bloco de tempo com regra especial; permite priorizar manutenção sobre feature.

### B-C-01 — Stabilization week

- **descricao**: 1 semana a cada 4. Apenas: paper-cuts UX, fix P0/P1, benchmark, redução de divergência docs↔código. **Zero** feature nova.
- **mvp_limit**: **toda 4ª semana**.
- **pro_limit**: idem.
- **enterprise_limit**: cadência mantida; pode ser estendida sob demanda.
- **baseline_status**: `partial` (não institucionalizada ainda).
- **interim_rule**: ativar a partir do próximo sprint após assinatura governance.
- **medicao**: calendário operacional.
- **enforcement**: bot bloqueia PRs com label `feature` durante a janela.
- **owner**: PO.

### B-C-02 — Freeze window

- **descricao**: 5 dias úteis antes de release público; apenas hotfix.
- **mvp_limit**: **5 dias** antes de cada release público.
- **pro_limit**: 3 dias.
- **enterprise_limit**: 2 dias.
- **baseline_status**: `unknown` (sem release público formal ainda).
- **interim_rule**: 5 dias a partir do primeiro release público.
- **medicao**: calendário.
- **enforcement**: bot bloqueia PRs com label `feature`/`refactor` na janela.
- **owner**: CTO + PO.

### B-C-03 — Benchmark cycle

- **descricao**: a cada 8 semanas, sprint dedicado a rodar suítes A/B/C/D/E/F do `BENCHMARK_STRATEGY.md`, atualizar baseline e publicar `BENCHMARK_REPORT_NN.md`.
- **mvp_limit**: **a cada 8 semanas**.
- **pro_limit**: a cada 6 semanas.
- **enterprise_limit**: a cada 4 semanas.
- **baseline_status**: `partial` (scripts existem; cadência não institucionalizada).
- **interim_rule**: ativar com primeiro benchmark cycle após F1.
- **medicao**: calendário; reports em `docs/benchmarks/**`.
- **enforcement**: PO + QA Lead assinam relatório; sem assinatura, próximo release marca como "benchmark pendente".
- **owner**: QA Lead.

### B-C-04 — Hardening cycle

- **descricao**: a cada 12 semanas, sprint dedicado a redução de débito (catalogado em `CODE_REVIEW_AUDIT.md`).
- **mvp_limit**: **a cada 12 semanas**.
- **pro_limit**: a cada 10 semanas.
- **enterprise_limit**: a cada 8 semanas.
- **baseline_status**: `unknown`.
- **interim_rule**: ativar após F2.
- **medicao**: calendário.
- **enforcement**: PO + CTO assinam.
- **owner**: CTO.

### B-C-05 — Debt reduction cycle (mini)

- **descricao**: 2 dias por sprint reservados a redução de débito + docs (descongelar `DOC_VS_CODE_DIVERGENCE`).
- **mvp_limit**: **2 dias por sprint**.
- **pro_limit**: 2 dias.
- **enterprise_limit**: 1 dia.
- **baseline_status**: `unknown`.
- **interim_rule**: ativar a partir do próximo sprint.
- **medicao**: time-tracking simples (planilha).
- **enforcement**: revisão na retrospectiva.
- **owner**: CTO.

### B-C-06 — No-new-feature period

- **descricao**: ativado **automaticamente** quando alguma stop condition Tier-S/A está triggered (ver `STOP_CONDITIONS.md`).
- **mvp_limit**: ativo enquanto stop condition não for `cleared`.
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known` (regra dura).
- **interim_rule**: regra ativa hoje.
- **medicao**: estado das stop conditions.
- **enforcement**: bot bloqueia PRs `feature` no escopo afetado.
- **owner**: PO + CTO.

---

## 5. Suíte D — Limites de mudança arquitetural

> Reforço operacional dos limites detalhados em [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md).

### B-D-01 — Não trocar stack core sem RFC

- **descricao**: troca de Next.js, Prisma, Supabase, Qdrant, Redis, Inngest, DeepSeek, DeepInfra, Vercel.
- **mvp_limit**: nenhum sem RFC + ≥ 1 trimestre de operação estável.
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known` (regra dura).
- **interim_rule**: ativa hoje.
- **medicao**: PR diff em `package.json`/`vercel.json`/`prisma.config.ts`.
- **enforcement**: `block-merge`.
- **owner**: CTO.

### B-D-02 — Não trocar embedding sem benchmark

- **descricao**: troca de modelo de embedding (BGE-M3 → outro).
- **mvp_limit**: proibido sem benchmark MVP atingido + coexistência de coleções planejada.
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known`.
- **interim_rule**: ativa hoje (`F-O-08`).
- **medicao**: PR + RFC.
- **enforcement**: `block-merge`.
- **owner**: IA owner + retrieval owner.

### B-D-03 — Não trocar chunker sem gold-set + replay

- **descricao**: troca de `legal-chunker-v2.ts` ou similar.
- **mvp_limit**: proibido sem gold-set CF/88 + replay (`F-O-09`).
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known`.
- **interim_rule**: ativa hoje.
- **medicao**: PR + RFC + relatório benchmark.
- **enforcement**: `block-merge`.
- **owner**: chunking owner + Legal Lead.

### B-D-04 — Não alterar schema sensível sem compatibility layer

- **descricao**: mudança de coluna/tabela com dados sensíveis ou referenciada por integrações exige migration backwards-compatible + plano N+2.
- **mvp_limit**: regra dura.
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known`.
- **interim_rule**: ativa hoje (DoD-03).
- **medicao**: review CTO + banco owner.
- **enforcement**: `block-merge`.
- **owner**: banco owner + CTO.

### B-D-05 — Não alterar API pública sem versionamento

- **descricao**: mudança de contrato em rotas `src/app/api/**` que terão consumo externo (atual: 0; futuro: P4) exige versionamento (`/v1` → `/v2`) + deprecação ≥ 2 ciclos.
- **mvp_limit**: regra dura.
- **pro_limit**: idem.
- **enterprise_limit**: idem.
- **baseline_status**: `known`.
- **interim_rule**: ativa quando API pública (`F-O-16`) for habilitada.
- **medicao**: PR diff em rotas com label `public-api`.
- **enforcement**: `block-merge`.
- **owner**: APIs owner + CTO.

---

## 6. Suíte E — Enforcement

### B-E-01 — O que bloqueia merge

- Excede algum limite Suíte A (B-A-01..B-A-07) sem override.
- Viola qualquer regra Suíte D (B-D-01..B-D-05).
- DoD-1..DoD-19 incompleto sem `N/A` justificado.
- Gates G-01..G-30 (etapas pré-merge) vermelhos.
- Owner principal do subsystem ausente em [`OWNER_MATRIX.md`](OWNER_MATRIX.md) (campo `_a preencher_`).
- Stop condition do subsystem está `triggered`.

### B-E-02 — O que bloqueia promote (production)

- Gates G-40..G-63 vermelhos.
- Excede limite de custo Suíte B (B-B-01..B-B-04) com `dispatch-stop`.
- No-new-feature period (B-C-06) ativo no escopo afetado.
- Smoke manual G-57 reprovado.

### B-E-03 — O que exige override formal

- Override de qualquer limite Suíte A em PR específica (≥ B-A-01..B-A-07).
- Override de DoD item.
- Override de gate G-01..G-80.
- Override de Stop Condition S-01..S-44.

Override segue [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §10: RFC + 3 alternativas + assinaturas + log + revisão pós-30 dias.

### B-E-04 — O que exige board review (decisão fora do time)

- Mudança de stack core (B-D-01).
- Override sobre `FORBIDDEN_ORDERINGS` Tier-S (F-O-01..F-O-08).
- Decisão de contrato enterprise que exige feature P3/P4.
- Decisão de mudar pricing.
- Resposta a notificação ANPD.

---

## 7. Tabela-resumo (quick reference)

| Dimensão | # budgets | Status agregado | Bloqueia |
|----------|----------:|-----------------|----------|
| A — Parallelism (sprint) | 7 | unknown na maioria, 1 known (B-A-07) | merge |
| B — Cost | 10 | todos `unknown` | promote (S-05) |
| C — Window | 6 | partial/unknown; 1 known (B-C-06) | merge no escopo / promote |
| D — Architecture | 5 | todos `known` (regras duras) | merge |
| E — Enforcement | 4 (regras de aplicação) | — | — |
| **Total** | **32** | **22 unknown / 10 known** | — |

---

## 8. Política de promoção `interim` → `enforced`

Idêntica à de [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) §10:

1. **30 dias** de medição contínua.
2. Variância ≤ 25%.
3. Limite MVP atingido em ≥ 80% do período.
4. Assinatura: PO + CTO + (Owner subsystem se aplicável).
5. Registro em `docs/governance/BUDGETS_LEDGER.md` (criado quando o primeiro budget virar enforced).

---

## 9. Como aplicar este doc

1. **Hoje**: aplicar Suíte D (regras duras `known`) imediatamente; Suítes A/B/C entram como `interim_rule` com revisão semanal pelo CTO.
2. **F0**: medir baselines (custo IA, parallelism real, número de PRs) para mover de `unknown` → `known`.
3. **F1**: instrumentar painel de saúde com contadores (PRs por label, custo por workspace, etc.).
4. **A cada release**: snapshot de B-A-* e B-B-* anexado ao release notes.

---

## 10. Anti-padrões proibidos

- "Vamos abrir mais 1 feature em paralelo, é rápida" → se viola B-A-01, vai para fila.
- "Esse cliente cobra mais, ignora cap" → cap é defensivo; revisar contrato, não cap.
- "Vamos rodar 5 migrations no mesmo dia" → viola B-A-03; abrir RFC.
- "Refactor enquanto faço a feature, dois pra um" → viola §5 do `EXECUTION_GOVERNANCE` no scope creep.

---

## Veja também

- [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md), [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md), [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md), [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md).
