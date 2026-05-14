---
title: Quality Thresholds — Lex
status: reviewed
owners: [QA Lead, CTO, Legal Lead, Security Lead]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/PRODUCT_SURVIVAL_MODE.md
  - docs/governance/BENCHMARK_STRATEGY.md
tier: mvp
---

# Quality Thresholds — Lex

> **Documento canônico que transforma gates e stop conditions em números.** Sem isso, governance vira opinião.
>
> **Honestidade obrigatória**: muitos thresholds estão hoje em `baseline_status: unknown` porque o produto **ainda não foi medido em produção** sob essas métricas. Esses itens **não são aplicáveis como bloqueio** até F0/F2 medirem o baseline real. Permanecem como **interim_rule** (regra conservadora) durante esse intervalo.
>
> **Promoção de "interim" para "enforced"** exige: 30 dias de medição contínua + assinatura QA Lead + (Legal Lead se métrica jurídica; Security Lead se métrica de segurança).

---

## 1. Schema de cada métrica

Cada métrica é descrita com **11 campos**:

| Campo | Definição |
|-------|-----------|
| `id` | identificador estável (ex.: `Q-A-01`) |
| `nome` | nome curto |
| `definicao` | o que mede em linguagem natural |
| `como_medir_hoje` | script existente, log, query SQL ou "manual" |
| `baseline_atual` | valor mais recente conhecido **ou** `unknown` |
| `baseline_status` | `known` \| `partial` \| `unknown` |
| `threshold_mvp` | número mínimo aceitável no MVP |
| `threshold_pro` | número mínimo aceitável no plano Pro |
| `threshold_enterprise` | número mínimo aceitável no plano Enterprise |
| `owner` | papel responsável |
| `stop_condition_relacionada` | S-id em [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md) |
| `gate_relacionado` | G-id em [`RELEASE_GATES.md`](RELEASE_GATES.md) |
| `acao_se_falhar` | `block-merge` \| `block-promote` \| `dispatch-stop` \| `require-override` |

Convenção: bandas relativas usam **multiplicadores do baseline** (ex.: "p95 ≤ 1.5× baseline"). Quando `baseline_status: unknown`, vale a `interim_rule`.

---

## 2. Suíte A — Retrieval

### Q-A-01 — `hits@1` no gold-set CF/88

- **definicao**: % das queries do gold-set CF/88 cuja **fonte verdadeira** está na **posição 1** do retorno final do pipeline `retrieveLegalContext`.
- **como_medir_hoje**: `pnpm cf:retrieval:smoke` (`scripts/cf-retrieval-smoke.ts`) + `pnpm corpus:audit-cf` (`scripts/cf-coverage-audit.ts`).
- **baseline_atual**: `unknown` (não publicado em release oficial).
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 0.55 (`interim_rule`: ≥ 0.45 até medirmos baseline).
- **threshold_pro**: ≥ 0.70.
- **threshold_enterprise**: ≥ 0.80.
- **owner**: retrieval owner + QA Lead.
- **stop_condition**: S-02.
- **gate**: G-50.
- **acao_se_falhar**: `block-promote`.

### Q-A-02 — `hits@3` no gold-set CF/88

- **definicao**: % das queries do gold-set CF/88 cuja **fonte verdadeira** aparece nas **3 primeiras** posições.
- **como_medir_hoje**: `pnpm cf:retrieval:smoke`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 0.75 (`interim`: ≥ 0.65).
- **threshold_pro**: ≥ 0.85.
- **threshold_enterprise**: ≥ 0.92.
- **owner**: retrieval owner.
- **stop_condition**: S-02.
- **gate**: G-50.
- **acao_se_falhar**: `block-promote`.

### Q-A-03 — `hits@5` no gold-set CF/88

- **definicao**: idem hits@1 mas top-5.
- **como_medir_hoje**: `pnpm cf:retrieval:smoke`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 0.85 (`interim`: ≥ 0.75).
- **threshold_pro**: ≥ 0.92.
- **threshold_enterprise**: ≥ 0.96.
- **owner**: retrieval owner.
- **stop_condition**: S-02.
- **gate**: G-50, G-52.
- **acao_se_falhar**: `block-promote`.

### Q-A-04 — `MRR` (Mean Reciprocal Rank) no gold-set

- **definicao**: média de `1/rank_da_primeira_fonte_verdadeira` em todas as queries do gold-set.
- **como_medir_hoje**: derivado de `cf-retrieval-smoke` (a script já reporta posições; agregação por release).
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 0.50.
- **threshold_pro**: ≥ 0.70.
- **threshold_enterprise**: ≥ 0.80.
- **owner**: retrieval owner.
- **stop_condition**: S-02.
- **gate**: G-50.
- **acao_se_falhar**: `block-promote`.

### Q-A-05 — Cobertura por domínio jurídico

- **definicao**: para cada domínio (constitucional, civil, processual civil, penal, processual penal, tributário, trabalhista, consumidor, ambiental, administrativo, empresarial, previdenciário): `hits@5` ≥ `threshold_mvp`.
- **como_medir_hoje**: `pnpm qa:retrieval:domains` (`scripts/legal-retrieval-domains-qa.ts`).
- **baseline_atual**: `unknown`.
- **baseline_status**: `partial` (script existe; gold-set por domínio incompleto — depende de `BENCHMARK_STRATEGY` §A).
- **threshold_mvp**: cada domínio crítico (constitucional/civil/processual civil) ≥ 0.80; demais ≥ 0.65.
- **threshold_pro**: críticos ≥ 0.90; demais ≥ 0.80.
- **threshold_enterprise**: críticos ≥ 0.95; demais ≥ 0.88.
- **owner**: retrieval owner.
- **stop_condition**: S-02.
- **gate**: G-52.
- **acao_se_falhar**: `block-promote`.

### Q-A-06 — Queries sem resposta

- **definicao**: % de queries em produção que retornam `chunks.length == 0` ou `groundingScore` em "Baixa" e `usedSources.length == 0`.
- **como_medir_hoje**: log estruturado em `recordObservabilityLog` + agregação Langfuse.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 12%.
- **threshold_pro**: ≤ 7%.
- **threshold_enterprise**: ≤ 3%.
- **owner**: retrieval owner + observabilidade owner.
- **stop_condition**: S-01, S-02.
- **gate**: G-71.
- **acao_se_falhar**: `dispatch-stop`.

### Q-A-07 — Fallback rate

- **definicao**: % de queries em que `fallbackFlags` indica fallback estendido (rerank off, Qdrant offline, embedding ausente).
- **como_medir_hoje**: log + agregação Langfuse / `recordObservabilityLog`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 8% por dia.
- **threshold_pro**: ≤ 3% por dia.
- **threshold_enterprise**: ≤ 1% por dia.
- **owner**: retrieval owner.
- **stop_condition**: S-04.
- **gate**: G-71.
- **acao_se_falhar**: `dispatch-stop`.

### Q-A-08 — Chunks irrelevantes no top-5

- **definicao**: % de chunks no top-5 marcados como **irrelevantes** por revisor jurídico em amostra ≥ 30 queries.
- **como_medir_hoje**: revisão manual (Legal Lead + 1 advogado) → planilha → `BENCHMARK_STRATEGY` §A.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 25%.
- **threshold_pro**: ≤ 15%.
- **threshold_enterprise**: ≤ 8%.
- **owner**: QA Lead + Legal Lead.
- **stop_condition**: S-01, S-02.
- **gate**: G-50, G-58.
- **acao_se_falhar**: `block-promote`.

---

## 3. Suíte B — Grounding

### Q-B-01 — `groundingScore` mínimo aceito para resposta exibida

- **definicao**: limiar abaixo do qual a resposta vai com banner "base insuficiente" ao invés de fundamento.
- **como_medir_hoje**: configuração no pipeline `retrieveLegalContext` + `source-sufficiency.ts`.
- **baseline_atual**: `0.45` (faixa "Média" no código atual).
- **baseline_status**: `known` (configuração).
- **threshold_mvp**: ≥ 0.45 (não exibir como fundamento abaixo disso).
- **threshold_pro**: ≥ 0.50.
- **threshold_enterprise**: ≥ 0.55.
- **owner**: retrieval owner + Legal Lead.
- **stop_condition**: S-01.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-B-02 — `groundingScore` mediano (release / janela 7 dias)

- **definicao**: mediana do `groundingScore` em produção em 7 dias.
- **como_medir_hoje**: `recordObservabilityLog` + Langfuse.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 0.55 (`interim`: ≥ 0.50).
- **threshold_pro**: ≥ 0.65.
- **threshold_enterprise**: ≥ 0.70.
- **owner**: retrieval owner.
- **stop_condition**: S-01.
- **gate**: G-72.
- **acao_se_falhar**: `dispatch-stop`.

### Q-B-03 — % de respostas com fonte citável

- **definicao**: % de respostas IA exibidas com `usedSources.length ≥ 1` **e** todas as fontes existem no corpus indexado.
- **como_medir_hoje**: log de payload de `/api/retrieval/search` + sample manual.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 90%.
- **threshold_pro**: ≥ 96%.
- **threshold_enterprise**: ≥ 99%.
- **owner**: retrieval owner + Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-B-04 — Citation accuracy

- **definicao**: % de citações em peças geradas cuja **referência exata** (URN-LEX + artigo + parágrafo se houver) bate com `LegalChunk` indexado.
- **como_medir_hoje**: amostra ≥ 30 peças por release; comparação manual contra schema; futuro: `legal-quality-engine` automatizado (planned, P2).
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 92%.
- **threshold_pro**: ≥ 97%.
- **threshold_enterprise**: ≥ 99%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58, G-22.
- **acao_se_falhar**: `block-promote`.

### Q-B-05 — Source existence

- **definicao**: % de fontes citadas que **existem** no corpus indexado (lookup direto em `LegalChunk` por URN+articleRef).
- **como_medir_hoje**: query SQL contra `LegalChunk` + `LegalNorm`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: 100% (regra **dura**: nenhum fundamento inventado).
- **threshold_pro**: 100%.
- **threshold_enterprise**: 100%.
- **owner**: Legal Lead.
- **stop_condition**: S-03 (qualquer < 100% triggered).
- **gate**: G-30 (DoD-07/08), G-58.
- **acao_se_falhar**: `dispatch-stop` + rollback `ROLLBACK_POLICY §4.1`.

### Q-B-06 — Source text match

- **definicao**: % de citações em que o **texto** parafraseado/citado bate semanticamente com o conteúdo do chunk referenciado (sem distorção de sentido).
- **como_medir_hoje**: revisão jurídica manual amostral (≥ 20 peças).
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 95%.
- **threshold_pro**: ≥ 98%.
- **threshold_enterprise**: ≥ 99%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

---

## 4. Suíte C — Legal quality

### Q-C-01 — Hallucination rate (geral)

- **definicao**: % de afirmações jurídicas exibidas ao usuário que **não** se sustentam em corpus indexado ou em documento do caso.
- **como_medir_hoje**: revisão manual ≥ 30 saídas por release.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 5%.
- **threshold_pro**: ≤ 2%.
- **threshold_enterprise**: ≤ 1%.
- **owner**: Legal Lead + IA owner.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `dispatch-stop`.

### Q-C-02 — Unsupported legal claim rate

- **definicao**: % de afirmações **jurídicas específicas** ("Art. X dispõe que...") sem chunk correspondente.
- **como_medir_hoje**: amostra de peças exportadas + revisão.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 3%.
- **threshold_pro**: ≤ 1%.
- **threshold_enterprise**: ≤ 0.5%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `dispatch-stop`.

### Q-C-03 — Wrong article rate

- **definicao**: % de citações cujo número/artigo está **errado** (artigo certo da norma errada, ou número trocado).
- **como_medir_hoje**: revisão manual; futuro: `legal-quality-engine` (P2).
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 4%.
- **threshold_pro**: ≤ 1.5%.
- **threshold_enterprise**: ≤ 0.5%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `dispatch-stop`.

### Q-C-04 — Irrelevant ADCT rate

- **definicao**: % de respostas em que o pipeline cita ADCT (Ato das Disposições Constitucionais Transitórias) **fora** do contexto adequado.
- **como_medir_hoje**: query log + filtro por chunk com `fullPath` contendo "ADCT" + revisão jurídica.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 5%.
- **threshold_pro**: ≤ 2%.
- **threshold_enterprise**: ≤ 1%.
- **owner**: retrieval owner + Legal Lead.
- **stop_condition**: S-02.
- **gate**: G-50.
- **acao_se_falhar**: `block-promote`.

### Q-C-05 — Normative mismatch

- **definicao**: % de respostas em que a norma citada está **revogada** na data informada (`asOf`) ou **não vigente** quando o caso exige.
- **como_medir_hoje**: revisão manual; futuro: `legal-quality-engine`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 3%.
- **threshold_pro**: ≤ 1%.
- **threshold_enterprise**: ≤ 0.3%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `dispatch-stop`.

### Q-C-06 — Procedural incoherence

- **definicao**: % de peças geradas com incoerência processual (rito errado, prazo errado, juízo incompetente sugerido).
- **como_medir_hoje**: revisão manual de peças.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 8%.
- **threshold_pro**: ≤ 3%.
- **threshold_enterprise**: ≤ 1%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-C-07 — Drafting blocker rate

- **definicao**: % de pedidos de geração que **bloqueiam** export por insuficiência de fonte (`source-sufficiency` em vermelho).
- **como_medir_hoje**: log de `drafting.ts`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: bloqueio aceito até 30% (UX deve explicar bem); meta longo prazo: ≤ 15%.
- **threshold_pro**: ≤ 20%.
- **threshold_enterprise**: ≤ 12%.
- **owner**: workflow jurídico owner + Legal Lead.
- **stop_condition**: indireta (alta taxa indica problema de UX e busca indexada, não regressão).
- **gate**: G-57 (qualidade da experiência).
- **acao_se_falhar**: `require-override` (não bloqueia, mas dispara revisão).

---

## 5. Suíte D — Drafting

### Q-D-01 — Peça sem placeholder

- **definicao**: % de peças exportadas **sem** marcadores `[descrever]`, `[fundamentar]`, `[lorem]`, `<TODO>`, `...`.
- **como_medir_hoje**: regex grep em peças exportadas + spot-check release.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: 100% (regra dura).
- **threshold_pro**: 100%.
- **threshold_enterprise**: 100%.
- **owner**: workflow jurídico owner.
- **stop_condition**: indireta (S-03 quando substituído por inventado).
- **gate**: G-30 (DoD-08).
- **acao_se_falhar**: `block-merge` / `block-promote`.

### Q-D-02 — Peça com partes corretas

- **definicao**: % de peças cujas **partes** (autor, réu, qualificação) batem com o `Case` (sem inversão, sem invenção).
- **como_medir_hoje**: revisão amostral.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 98%.
- **threshold_pro**: ≥ 99.5%.
- **threshold_enterprise**: 100%.
- **owner**: workflow jurídico owner + Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-D-03 — Peça com pedidos corretos

- **definicao**: % de peças com pedidos coerentes com `RequestKind` registrado no caso (principal, subsidiário, urgência, provas, processual).
- **como_medir_hoje**: amostra de peças × `Case.requests`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 95%.
- **threshold_pro**: ≥ 98%.
- **threshold_enterprise**: ≥ 99.5%.
- **owner**: workflow jurídico owner + Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-D-04 — Peça com fundamento aprovado

- **definicao**: % de peças cujas fundamentações citam apenas `ApprovedLegalFoundation` ou pinned sources.
- **como_medir_hoje**: log do `drafting.ts` + cruzamento com `library_foundations`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 90%.
- **threshold_pro**: ≥ 97%.
- **threshold_enterprise**: ≥ 99%.
- **owner**: Legal Lead.
- **stop_condition**: S-03.
- **gate**: G-58.
- **acao_se_falhar**: `block-promote`.

### Q-D-05 — Taxa de peça reprovada pelo review

- **definicao**: % de peças cujo `review.ts` retorna `verdict = REJECTED` ou `CHANGES_REQUESTED`.
- **como_medir_hoje**: query em `DraftApproval` + agregação.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 30% (UX aceitável, indica review funciona).
- **threshold_pro**: ≤ 20%.
- **threshold_enterprise**: ≤ 12%.
- **owner**: workflow jurídico owner.
- **stop_condition**: indireta.
- **gate**: G-57.
- **acao_se_falhar**: `require-override` se passar 50% (sinal de drafting ruim).

### Q-D-06 — Export blocked por fonte insuficiente

- **definicao**: % de tentativas de export bloqueadas pelo `source-sufficiency.ts` ou `drafting-guard.ts`.
- **como_medir_hoje**: log do export endpoint.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: nenhum; aceitar bloqueio enquanto reduzir EX-03.
- **threshold_pro**: meta ≤ 15%.
- **threshold_enterprise**: meta ≤ 8%.
- **owner**: workflow jurídico owner + Legal Lead.
- **stop_condition**: indireta.
- **gate**: G-58 (qualidade da mensagem ao usuário).
- **acao_se_falhar**: `require-override` se bloqueio crônico.

---

## 6. Suíte E — UX

### Q-E-01 — Completion rate da jornada principal

- **definicao**: % de sessões que completam Login → Caso → Documento → Pesquisa → Peça → Review → Export.
- **como_medir_hoje**: instrumentação via `CaseTimelineEvent` + Posthog/Plausible (não confirmado em prod) → manual amostral até instrumentar.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≥ 60% (entre usuários que iniciaram caso).
- **threshold_pro**: ≥ 75%.
- **threshold_enterprise**: ≥ 85%.
- **owner**: PO + UX owner.
- **stop_condition**: S-31.
- **gate**: G-57.
- **acao_se_falhar**: `dispatch-stop`.

### Q-E-02 — Dead-end reports

- **definicao**: nº de relatos confirmados de dead-end (usuário não consegue avançar) por 1.000 sessões.
- **como_medir_hoje**: suporte/feedback (`Feedback` table existe — `src/app/api/feedback/route.ts`).
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 5/1000.
- **threshold_pro**: ≤ 2/1000.
- **threshold_enterprise**: ≤ 0.5/1000.
- **owner**: PO.
- **stop_condition**: S-30.
- **gate**: G-57.
- **acao_se_falhar**: `dispatch-stop`.

### Q-E-03 — Cobertura de empty/error states

- **definicao**: % de páginas/componentes novos que têm os 3 estados (loading/empty/error).
- **como_medir_hoje**: code review checklist DoD-14.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: 100% para páginas novas.
- **threshold_pro**: 100%.
- **threshold_enterprise**: 100%.
- **owner**: UX owner.
- **stop_condition**: indireta.
- **gate**: G-30 (DoD-14).
- **acao_se_falhar**: `block-merge`.

### Q-E-04 — Tempo até próxima ação clara

- **definicao**: mediana do tempo entre fim de uma ação (ex.: documento processado) e clique seguinte coerente.
- **como_medir_hoje**: instrumentação via `CaseTimelineEvent` + `next-actions.ts`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 30 s mediana.
- **threshold_pro**: ≤ 20 s.
- **threshold_enterprise**: ≤ 10 s.
- **owner**: UX owner.
- **stop_condition**: S-33.
- **gate**: G-57.
- **acao_se_falhar**: `require-override`.

---

## 7. Suíte F — Performance

### Q-F-01 — Latência retrieval p50

- **definicao**: mediana do tempo total de `retrieveLegalContext`.
- **como_medir_hoje**: log `trace.totalLatencyMs` em `recordObservabilityLog`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 1.500 ms.
- **threshold_pro**: ≤ 900 ms.
- **threshold_enterprise**: ≤ 600 ms.
- **owner**: retrieval owner.
- **stop_condition**: S-21.
- **gate**: G-72.
- **acao_se_falhar**: `dispatch-stop`.

### Q-F-02 — Latência retrieval p95

- **definicao**: idem p50, percentil 95.
- **como_medir_hoje**: idem.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 4.000 ms.
- **threshold_pro**: ≤ 2.500 ms.
- **threshold_enterprise**: ≤ 1.500 ms.
- **owner**: retrieval owner.
- **stop_condition**: S-21.
- **gate**: G-72.
- **acao_se_falhar**: `dispatch-stop`.

### Q-F-03 — Latência drafting p50/p95

- **definicao**: tempo total de `/api/cases/[id]/draft` (intake → drafting → persist).
- **como_medir_hoje**: log do endpoint + Langfuse.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: p50 ≤ 25 s; p95 ≤ 60 s.
- **threshold_pro**: p50 ≤ 15 s; p95 ≤ 35 s.
- **threshold_enterprise**: p50 ≤ 10 s; p95 ≤ 25 s.
- **owner**: workflow jurídico owner + IA owner.
- **stop_condition**: indireta.
- **gate**: G-72.
- **acao_se_falhar**: `dispatch-stop` se p95 estourar.

### Q-F-04 — Latência export p50/p95

- **definicao**: tempo de geração DOCX/PDF do endpoint `/api/cases/[id]/drafts/[draftId]/export`.
- **como_medir_hoje**: log do endpoint.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: p50 ≤ 5 s; p95 ≤ 15 s.
- **threshold_pro**: p50 ≤ 3 s; p95 ≤ 8 s.
- **threshold_enterprise**: p50 ≤ 2 s; p95 ≤ 5 s.
- **owner**: exports owner.
- **stop_condition**: indireta.
- **gate**: G-72.
- **acao_se_falhar**: `require-override`.

### Q-F-05 — Build time (CI)

- **definicao**: tempo total do job `lint-typecheck-test-build` em CI.
- **como_medir_hoje**: GitHub Actions.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 12 min.
- **threshold_pro**: ≤ 9 min.
- **threshold_enterprise**: ≤ 7 min.
- **owner**: CTO.
- **stop_condition**: indireta.
- **gate**: G-13.
- **acao_se_falhar**: `require-override`.

### Q-F-06 — API 5xx rate

- **definicao**: % de requests `/api/**` com status 5xx em janela 1h.
- **como_medir_hoje**: Vercel logs + observabilidade.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 1% por hora.
- **threshold_pro**: ≤ 0.3% por hora.
- **threshold_enterprise**: ≤ 0.1% por hora.
- **owner**: observabilidade owner.
- **stop_condition**: S-20.
- **gate**: G-71.
- **acao_se_falhar**: `dispatch-stop`.

### Q-F-07 — Qdrant timeout rate

- **definicao**: % de chamadas Qdrant que dão timeout.
- **como_medir_hoje**: log `fallbackFlags` + monitoring Qdrant Cloud.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 2% por janela 30 min.
- **threshold_pro**: ≤ 0.5%.
- **threshold_enterprise**: ≤ 0.2%.
- **owner**: retrieval owner + infra owner.
- **stop_condition**: S-24.
- **gate**: G-71.
- **acao_se_falhar**: `dispatch-stop`.

### Q-F-08 — DeepInfra timeout rate (embeddings + reranker)

- **definicao**: % de chamadas DeepInfra com timeout/erro.
- **como_medir_hoje**: log `fallbackFlags` + retry counters.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 3% por janela 30 min.
- **threshold_pro**: ≤ 1%.
- **threshold_enterprise**: ≤ 0.3%.
- **owner**: IA owner + infra owner.
- **stop_condition**: S-04.
- **gate**: G-71.
- **acao_se_falhar**: `dispatch-stop`.

---

## 8. Suíte G — Cost

### Q-G-01 — Custo máximo por query

- **definicao**: $ por chamada completa de `retrieveLegalContext` (embedding + rerank + chamada LLM se houver síntese).
- **como_medir_hoje**: cálculo a partir de tokens consumidos + tabela de preço; planilha até instrumentar Langfuse cost.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ $0.012 / query.
- **threshold_pro**: ≤ $0.008.
- **threshold_enterprise**: ≤ $0.005.
- **owner**: IA owner + CTO.
- **stop_condition**: S-05.
- **gate**: G-73.
- **acao_se_falhar**: `dispatch-stop`.

### Q-G-02 — Custo máximo por peça

- **definicao**: $ por geração completa de peça (intake + retrieval + drafting + review).
- **como_medir_hoje**: agregação por trace.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ $0.40 / peça.
- **threshold_pro**: ≤ $0.25.
- **threshold_enterprise**: ≤ $0.15.
- **owner**: IA owner + CTO.
- **stop_condition**: S-05.
- **gate**: G-73.
- **acao_se_falhar**: `dispatch-stop`.

### Q-G-03 — Custo máximo por caso

- **definicao**: $ acumulado por caso completo (intake + N pesquisas + N peças + reviews + exports).
- **como_medir_hoje**: agregação por `caseId`.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ $3.00 / caso (mediana).
- **threshold_pro**: ≤ $2.00 / caso.
- **threshold_enterprise**: ≤ $1.20 / caso.
- **owner**: IA owner + CTO.
- **stop_condition**: S-05.
- **gate**: G-73.
- **acao_se_falhar**: `dispatch-stop`.

### Q-G-04 — Custo máximo por workspace/dia

- **definicao**: $ acumulado por workspace por dia (cap defensivo).
- **como_medir_hoje**: agregação por `workspaceId` por dia.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: cap soft em $25/dia/workspace; hard em $40 (alerta + freeze de chamadas custosas).
- **threshold_pro**: soft $15; hard $25.
- **threshold_enterprise**: definido por contrato.
- **owner**: CTO + IA owner.
- **stop_condition**: S-05.
- **gate**: G-73.
- **acao_se_falhar**: `dispatch-stop`.

### Q-G-05 — Spike permitido

- **definicao**: multiplicador máximo do custo diário em janela 24 h vs baseline 7 dias.
- **como_medir_hoje**: agregação diária.
- **baseline_atual**: `unknown`.
- **baseline_status**: `unknown`.
- **threshold_mvp**: ≤ 2.0×.
- **threshold_pro**: ≤ 1.7×.
- **threshold_enterprise**: ≤ 1.4×.
- **owner**: IA owner + CTO.
- **stop_condition**: S-05.
- **gate**: G-73.
- **acao_se_falhar**: `dispatch-stop`.

---

## 9. Tabela-resumo (quick reference)

| Suíte | Métricas | Status agregado | Bloqueia |
|-------|---------:|-----------------|----------|
| A — Retrieval | 8 | majoritariamente `unknown` | promote (G-50..G-52, G-71) |
| B — Grounding | 6 | 1 `known`, demais `unknown` | promote (G-58, G-30) |
| C — Legal quality | 7 | todos `unknown` | promote (G-58) + dispatch-stop (S-03) |
| D — Drafting | 6 | todos `unknown` (1 regra dura: placeholder) | merge/promote (G-30) |
| E — UX | 4 | todos `unknown` | promote (G-57) |
| F — Performance | 8 | todos `unknown` | promote (G-71/G-72) |
| G — Cost | 5 | todos `unknown` | promote (G-73) |
| **Total** | **44** | **42 unknown / 2 known** | — |

---

## 10. Política de promoção `interim` → `enforced`

Toda métrica em `baseline_status: unknown` segue **interim_rule** (regra conservadora): bloqueia apenas se houver **regressão significativa** vs medição do dia anterior. Não bloqueia release no primeiro snapshot.

Para virar `enforced` (bloquear release com base em valor absoluto):

1. **30 dias** de medição contínua.
2. Variância ≤ 25% (estabilidade).
3. Threshold MVP atingido em ≥ 80% do período.
4. Assinatura: QA Lead + Owner de subsystem + (Legal Lead se métrica jurídica; Security Lead se segurança).
5. Registro no PR de promoção em `docs/governance/THRESHOLDS_LEDGER.md` (criado quando a primeira métrica virar enforced).

---

## 11. Override

Override de threshold exige RFC + assinaturas:

- Suíte A/B: QA Lead + retrieval owner + Legal Lead.
- Suíte C/D: Legal Lead + workflow jurídico owner.
- Suíte E: PO + UX owner.
- Suíte F/G: CTO + IA owner.

Override frequente (≥3 / trimestre / mesma métrica) dispara revisão da regra (sintoma de threshold mal calibrado **ou** problema sistêmico).

---

## 12. Como aplicar este doc

1. **Hoje**: doc é canônico. Toda RFC nova cita métricas relevantes.
2. **F0**: medir baselines reais para mover de `unknown` → `partial` ou `known`.
3. **F2**: instrumentar Langfuse + dashboards para sustentar suítes A/B/F/G em produção.
4. **F4**: medir Suítes C/D em ciclo manual (Legal Lead + 1 advogado) e registrar em `BENCHMARK_STRATEGY` §B.
5. **A cada release**: snapshot de todas as 44 métricas com status atual.

---

## Veja também

- [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`RELEASE_GATES.md`](RELEASE_GATES.md), [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md), [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md), [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md).
