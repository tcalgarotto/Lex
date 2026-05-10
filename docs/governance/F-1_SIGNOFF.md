---
title: F-1 Sign-Off — Lex (governance provisional sign-off)
status: published
owners: [PO, CTO]
audience: [dev, admin, investor]
updated: 2026-05-10
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/OWNER_MATRIX.md
  - docs/governance/EXECUTION_REPORT_F-1_LEVA_1.md
  - docs/governance/EXECUTION_REPORT_F-1_LEVA_2.md
  - docs/governance/PRODUCT_SURVIVAL_MODE.md
  - docs/governance/FORBIDDEN_ORDERINGS.md
tier: mvp
---

# F-1 Sign-Off — Lex

> **Documento de checkpoint** que registra o **fechamento formal de F-1** (Levas 1 + 2) e o **sign-off provisório de governance**. Esta é a peça que destrava o início de **F0 — Auditoria** com escopo controlado e que **mantém bloqueada** a promoção a produção pública até substituição dos papéis provisórios.
>
> **Princípio**: governance "executável" depende de **alguém assinar**. Aceitar assinatura provisória é honesto; fingir que ela equivale a assinatura definitiva é desonesto e seria violação de `FORBIDDEN_ORDERINGS F-O-15`.

---

## 1. Escopo deste checkpoint

Este documento responde, em ordem:

1. Quais papéis foram preenchidos em [`OWNER_MATRIX.md`](OWNER_MATRIX.md) e [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §13.
2. Quais são definitivos.
3. Quais são provisórios.
4. Quais precisam ser substituídos por pessoa real **antes de produção pública**.
5. Se F0 pode começar — e com que restrições.
6. Quais restrições continuam ativas enquanto provisórios existirem.

**Não executa nada além do checkpoint.** Não corrige inconsistências. Não muda código. Não inicia F0.

---

## 2. Papéis preenchidos (roster funcional 2026-05-10)

> Espelha §0 de [`OWNER_MATRIX.md`](OWNER_MATRIX.md). Todo subsystem em §3 daquele doc usa exclusivamente este roster.

| Alias canônico | Papel funcional | Pessoa / função | Status | Observação |
|----------------|-----------------|------------------|--------|-------------|
| `Thales (PO)` | PO de Produto | Thales | **DEFINITIVO** | Owner real do produto Lex; bus factor 1 humano |
| `Thales/Cursor (CTO interim)` | CTO / Tech Lead | Thales + Cursor agent (executor técnico assistido) | **PROVISÓRIO** | Cursor agent é executor, não substituto operacional independente em incidente; precisa de segundo humano técnico antes de produção |
| `Legal Lead [PROVISÓRIO]` | Legal Lead | Advogado parceiro / consultor jurídico a designar | **PROVISÓRIO** | Sem nomeação até 2026-05-10; F0 prossegue com escopo interno |
| `Security Lead [PROVISÓRIO]` | Security Lead | Responsável técnico de segurança a designar | **PROVISÓRIO** | Sem nomeação até 2026-05-10; F0 prossegue com escopo interno |
| `QA Lead [PROVISÓRIO]` | QA / Benchmark Lead | Responsável técnico de QA a designar | **PROVISÓRIO** | Sem nomeação até 2026-05-10; F0 prossegue com escopo interno |

**Resumo numérico**:
- Definitivos: **1** papel (PO).
- Provisórios: **4** papéis (CTO interim, Legal Lead, Security Lead, QA Lead).
- Pendentes (sem nenhuma cobertura, mesmo provisória): **0**.

---

## 3. Quais são definitivos

- **PO de Produto = Thales**: definitivo enquanto Thales liderar o produto. Mudança exige PR + atualização de [`OWNER_MATRIX.md`](OWNER_MATRIX.md) + entrada no ledger §6 deste documento.

---

## 4. Quais são provisórios

> Cada provisório carrega uma **dívida de governance**. A dívida só é quitada quando substituído por humano nomeado, registrado neste documento §6.

### 4.1 `Thales/Cursor (CTO interim)` — CTO / Tech Lead

- **Cobertura provisória**: Thales acumula PO + CTO interim; Cursor agent atua como **executor técnico assistido** (gera/edita/audita código, propõe migrations, escreve docs, roda diagnósticos).
- **Limite**: Cursor agent **não** assume responsabilidade humana por incidente em produção, decisão de rollback complexa fora-de-jornada, ou diagnóstico de incidente que exija juízo humano sob pressão.
- **Substituição obrigatória antes de**: promoção a **produção pública pagante** (release público com cliente real).
- **Mitigação enquanto provisório**: dupla revisão obrigatória (Thales + Cursor agent) em PRs Tier-S; rollback conservador via toggle/env (`ROLLBACK_POLICY` §4); preferência por mudanças reversíveis e cirúrgicas.

### 4.2 `Legal Lead [PROVISÓRIO]` — Legal Lead

- **Cobertura provisória**: nenhuma pessoa nomeada; decisões de qualidade jurídica e LGPD ficam sob filtro de Thales (PO) com nota explícita "aguarda Legal Lead nomeado".
- **Limite**: nenhuma decisão sobre Tier-S `IA / drafting / chunking / LGPD / memória` pode ser **promovida a produção pública** sem assinatura humana de Legal Lead.
- **Substituição obrigatória antes de**:
  - publicar `docs/security/LGPD.md` + DPA;
  - habilitar WhatsApp/email/voz live (`F-O-04`/`F-O-06`/`F-O-20`);
  - subir tribunais para `live` (`F-O-05`);
  - vender Pro/Enterprise (`F-O-11`);
  - qualquer release público.
- **Mitigação enquanto provisório**: zero promessa pública de qualidade jurídica auditada por Legal Lead; uso da `TRUTH_HIERARCHY.md` regras §3 como filtro mínimo; revisão humana 100% das peças geradas durante demos com piloto.

### 4.3 `Security Lead [PROVISÓRIO]` — Security Lead

- **Cobertura provisória**: nenhuma pessoa nomeada; controles existentes (`src/lib/auth/**`, RLS Supabase, headers CSP em `next.config.ts`) operam como herdados; auditorias formais (RBAC_COVERAGE_MATRIX, IDOR check, BM-E-01..06) **adiadas** até nomeação.
- **Limite**: nenhuma rota nova em `src/app/api/**` que envolva PII/segredo/cross-tenant pode ser promovida a produção pública sem assinatura humana de Security Lead.
- **Substituição obrigatória antes de**:
  - habilitar SSO/SAML/SCIM (`F-O-17`);
  - bulk export (`F-O-19`);
  - qualquer release público;
  - resposta a notificação de ANPD/cliente sob LGPD (`S-14`).
- **Mitigação enquanto provisório**: regra dura DoD-10 (RBAC server-side em rotas novas); nenhuma mudança em headers/CSP/auth/RLS sem RFC + revisão Thales + Cursor agent; zero promoção a produção pública.

### 4.4 `QA Lead [PROVISÓRIO]` — QA / Benchmark Lead

- **Cobertura provisória**: nenhuma pessoa nomeada; benchmarks rodam manualmente conforme [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md); promoção de métrica `interim` → `enforced` **adiada** até nomeação.
- **Limite**: nenhuma mudança em `retrieval / embeddings / chunker / IA prompts` pode ser promovida a produção pública sem assinatura humana de QA Lead (referência Suítes A/B/C de `BENCHMARK_STRATEGY.md`).
- **Substituição obrigatória antes de**:
  - promoção de qualquer threshold de [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) para `enforced`;
  - qualquer mudança Tier-S em `retrieval / embeddings / chunker` (`A-C-01`/`A-D-01`/`F-O-08`/`F-O-09`);
  - mudança de prompt drafting com benchmark adversarial (`F-O-10`/`A-G-03`);
  - qualquer release público.
- **Mitigação enquanto provisório**: rodar regression suite v0 (scripts existentes em `package.json`) por release; baseline registrado mas não enforced; mudança em retrieval/IA limitada à frequência de B-A-05 (1/sprint).

---

## 5. F0 pode começar?

### 5.1 Decisão

**Sim — F0 — Auditoria está autorizada a iniciar** com **escopo restrito** abaixo. **Não** está autorizada qualquer promoção a produção pública nem mudança que viole as restrições §5.3.

### 5.2 Escopo autorizado para F0

F0 cobre exatamente o que está descrito no plano mestre v3.2 e nos relatórios da F-1:

| Tarefa F0 | Autorizada? | Observação |
|-----------|:-----------:|------------|
| Corrigir inconsistências do `EXECUTION_REPORT_F-1_LEVA_1.md` §4–§8 (README × código, redirects fantasma, scripts ausentes, etc.) | ✓ | trabalho em docs + scripts utilitários sem mudar comportamento |
| Medir baselines reais das 44 métricas de [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) | ✓ | rodar scripts existentes + observabilidade; sem alterar pipeline |
| Popular gold-sets formais §9 do [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) | ✓ | curadoria humana + revisão Legal Lead provisório (Thales filtra com `TRUTH_HIERARCHY`) |
| Publicar `MASTER_INDEX.md`, `MASTER_ROADMAP.md`, `DOC_VS_CODE_DIVERGENCE.md` | ✓ | trabalho documental |
| Produzir `docs/security/RBAC_COVERAGE_MATRIX.md` (Leva 1 §5.7) | ✓ | inspeção de código + tabela; **não** muda código |
| Atualizar `README.md` para refletir realidade (`/biblioteca`, `/retrieval`, `LegalSource` legacy, scripts inexistentes) | ✓ | trabalho documental |
| Instituir cadência operacional §6 do `EXECUTION_GOVERNANCE.md` (planning, daily quality check, RFC review, retrospective) | ✓ | processo, sem código |
| Instituir `INCIDENT_LOG.md`, `POSTMORTEM_TEMPLATE.md`, `STOP_LEDGER.md` | ✓ | templates documentais |
| Snapshot inicial de `HEALTH_METRICS.md` | ✓ | planilha/markdown |

### 5.3 Restrições ativas durante F0 (e além, enquanto provisórios existirem)

> Estas restrições aplicam-se **a todo o tempo** em que `[PROVISÓRIO]` aparecer em qualquer Tier-S/A do `OWNER_MATRIX`.

1. **Nenhuma promoção a produção pública**. Demos controladas com 1 advogado piloto sob acordo informal são permitidas com label "uso interno / sandbox" e bloqueio de export de dados sensíveis.
2. **Nenhuma mudança em embedding / chunker / prompts de drafting**. Vide `F-O-08`/`F-O-09`/`F-O-10` + `A-C-01`/`A-D-01`/`A-G-03`.
3. **Nenhuma integração live com tribunais**. PJe/eSAJ/Projudi/eproc/DataJud permanecem em mock/scaffold. Vide `F-O-05`/`F-O-13`.
4. **Nenhum WhatsApp / email / voz live**. Adapters mock pronto; live exige LGPD doc + DPA + Legal Lead nomeado. Vide `F-O-06`/`F-O-20`.
5. **Nenhum SSO/SAML/SCIM / bulk export / API pública / marketplace / landing builder / billing**. Vide `F-O-16`/`F-O-17`/`F-O-19`/`F-O-02`/`F-O-03`/`F-O-18`.
6. **Nenhuma venda Pro/Enterprise**. Vide `F-O-11`.
7. **Nenhuma promessa pública de feature `planned`/`partial` sem rótulo de futuro**. Vide `F-O-15`.
8. **Nenhuma promoção de threshold `interim` → `enforced` em [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md)** sem assinatura QA Lead nomeado.
9. **Toda PR Tier-S/A em F0 que toque IA / retrieval / embeddings / chunker / drafting / segurança / LGPD exige dupla revisão** (Thales (PO) + Thales/Cursor (CTO interim)) com nota explícita "aguarda owner definitivo" quando o owner do subsystem é provisório.
10. **Survival Mode segue ativo** (vide [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md) §1) por todos os critérios; restrições §4 daquele doc continuam.

### 5.4 Checkpoints obrigatórios após F0

- **Checkpoint F0 → F1**: novo sign-off intermediário antes de F1 começar, confirmando que (a) inconsistências da Leva 1 foram tratadas; (b) baselines medidos; (c) primeira `HEALTH_METRICS.md` publicada; (d) status do roster §0 atualizado (idealmente com ≥ 1 provisório nomeado).
- **Checkpoint produção pública**: novo sign-off com **5 assinaturas humanas reais** (PO + CTO + Legal + Security + QA), `OWNER_MATRIX` sem `[PROVISÓRIO]` em Tier-S/A, e zero P0 `partial`. Sem isso, **gate G-62** bloqueia promote (ver [`RELEASE_GATES.md`](RELEASE_GATES.md) §3.7).

---

## 6. Ledger de substituição (provisórios → humanos nomeados)

> Atualizar **no mesmo dia** em que cada `[PROVISÓRIO]` for substituído. Cada entrada exige PR de atualização de `OWNER_MATRIX.md` + nota neste ledger.

| Data | Papel | Antes | Depois | PR / commit | Aprovado por |
|------|-------|-------|--------|-------------|--------------|
| 2026-05-10 | PO de Produto | (não definido) | Thales | _PR de checkpoint F-1 sign-off_ | Thales (PO) |
| 2026-05-10 | CTO / Tech Lead | (não definido) | Thales/Cursor (CTO interim) — provisório | _PR de checkpoint F-1 sign-off_ | Thales (PO) |
| 2026-05-10 | Legal Lead | (não definido) | `[PROVISÓRIO]` — a nomear | _PR de checkpoint F-1 sign-off_ | Thales (PO) |
| 2026-05-10 | Security Lead | (não definido) | `[PROVISÓRIO]` — a nomear | _PR de checkpoint F-1 sign-off_ | Thales (PO) |
| 2026-05-10 | QA / Benchmark Lead | (não definido) | `[PROVISÓRIO]` — a nomear | _PR de checkpoint F-1 sign-off_ | Thales (PO) |

> Próximas linhas: cada nomeação real (ex.: "2026-XX-XX | Legal Lead | `[PROVISÓRIO]` | <Nome> | <PR> | <PO>").

---

## 7. Conflitos de papéis declarados (regra §4.6 do `OWNER_MATRIX.md`)

> Hoje, com equipe < 5 pessoas e 4 papéis provisórios, há acúmulos. Regra do OWNER_MATRIX permite isso enquanto declarado. Lista oficial:

| Acúmulo | Justificativa | Mitigação | Substituição obrigatória antes de |
|---------|---------------|------------|--------------------------------------|
| Thales = PO + CTO interim | equipe < 5; sem segundo humano técnico | dupla leitura (Thales + Cursor agent) em PRs Tier-S; preferência por mudança reversível | release público |
| Thales = `owner_principal` + `owner_secundario` em alguns subsystems (UX, workflow jurídico, observabilidade, exports, infra, banco, deploy, governance, CRM, financeiro, mobile, marketplace) | bus factor humano = 1 | declarar conflito em todo PR; `OWNER_MATRIX` §4.6 ativo | release público |
| Legal Lead [PROVISÓRIO] em `IA / chunking / workflow jurídico / LGPD / memória / financeiro / marketplace` | sem advogado parceiro nomeado | revisão Thales (PO) + nota "aguarda Legal Lead"; sem release público | release público; promoção de `interim` → `enforced` em métricas Suíte C/D |
| Security Lead [PROVISÓRIO] em `segurança / LGPD / APIs / documentos / integrações / financeiro / mobile` | sem responsável técnico de segurança nomeado | controles herdados em uso; auditorias adiadas (BM-E-*); sem release público | release público; tribunais live; bulk export; SSO |
| QA Lead [PROVISÓRIO] em `retrieval / embeddings / rerank / chunking / benchmarks` | sem responsável técnico de QA nomeado | regression suite v0 manual; sem promoção de threshold | release público; mudança Tier-S em retrieval/embedding/chunker |

---

## 8. Restrições continuam ativas (resumo executivo)

1. **Survival Mode** ativo — `PRODUCT_SURVIVAL_MODE.md` §4 lista 12 itens congelados.
2. **17 das 20 forbidden orderings** ([`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md)) bloqueiam algum movimento de roadmap **agora**: F-O-01..F-O-17 + F-O-19/F-O-20 (apenas `F-O-12` "jurimetria sem fonte" é puramente de comunicação).
3. **42 de 44 métricas** continuam `unknown`/`interim` em [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md).
4. **22 de 32 budgets** continuam `unknown`/`interim` em [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md).
5. **6 gold-sets** ainda não populados formalmente em [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md) §9.
6. **Bus factor humano** = 1 em **todos** os subsystems Tier-S/A — risco operacional aceito durante F-1/F0; **inaceitável** para produção pública.

---

## 9. Recomendação clara

### 9.1 F0 pode começar?

**Sim, F0 está autorizada a iniciar com escopo restrito (§5.2)** e **mantém** todas as restrições §5.3 + §8.

### 9.2 Próxima ação recomendada (ordem)

1. **Mergear este checkpoint** ([`F-1_SIGNOFF.md`](F-1_SIGNOFF.md) + atualizações em [`OWNER_MATRIX.md`](OWNER_MATRIX.md), [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §13, [`EXECUTION_REPORT_F-1_LEVA_2.md`](EXECUTION_REPORT_F-1_LEVA_2.md) §11).
2. **Iniciar F0 — Auditoria** com escopo §5.2; sem nenhuma das ações §5.3.
3. **Em paralelo**: PO conduz busca por **Legal Lead nomeado** (advogado parceiro / consultor jurídico) antes de qualquer demo com piloto real envolvendo dados jurídicos sensíveis.
4. **Em paralelo**: PO conduz busca por **Security Lead nomeado** antes de habilitar qualquer integração live, bulk export ou SSO.
5. **Em paralelo**: PO conduz busca por **QA Lead nomeado** antes de promover qualquer threshold para `enforced` ou tocar em retrieval/embeddings/chunker para fora do `interim_rule`.
6. **Cada nomeação** atualiza `OWNER_MATRIX.md` + ledger §6 deste documento + sign-off completo em `EXECUTION_GOVERNANCE.md` §13 (substituindo a linha provisória).

### 9.3 Resumo executivo (1 frase)

> **F-1 fechada com sign-off provisório; F0 autorizada para escopo interno sob restrições; promoção a produção pública continua bloqueada até substituição dos 4 papéis provisórios por humanos nomeados.**

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) §13 — assinatura provisória registrada.
- [`OWNER_MATRIX.md`](OWNER_MATRIX.md) — roster §0, restrições §0, notas §8.
- [`EXECUTION_REPORT_F-1_LEVA_1.md`](EXECUTION_REPORT_F-1_LEVA_1.md) — inconsistências a serem tratadas em F0.
- [`EXECUTION_REPORT_F-1_LEVA_2.md`](EXECUTION_REPORT_F-1_LEVA_2.md) §11 — checkpoint de sign-off (espelho desta decisão).
- [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md), [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md), [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md), [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md), [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md), [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md), [`TRUTH_HIERARCHY.md`](TRUTH_HIERARCHY.md), [`RELEASE_GATES.md`](RELEASE_GATES.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md), [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md), [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md).
