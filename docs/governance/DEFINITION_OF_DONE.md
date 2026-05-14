---
title: Definition of Done — Lex
status: reviewed
owners: [PO, CTO, QA Lead]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/ROLLBACK_POLICY.md
tier: mvp
---

# Definition of Done — Lex

> **Documento canônico de "o que conta como pronto".** Toda PR deve marcar **os 19 itens** como `Done` ou justificar `N/A: motivo`. Sem checklist completo, **G-30** (em [`RELEASE_GATES.md`](RELEASE_GATES.md)) bloqueia o merge.

> **Filosofia**: "rodou na minha máquina" não é done. "Mergeado" não é done. Done é **provado**, **observável**, **rollbackável** e **explicável ao advogado**.

---

## 1. Como usar

Copiar o checklist abaixo no **corpo da PR** ou em arquivo `.github/PULL_REQUEST_TEMPLATE.md` (criado quando F6 plugar CI). Itens não aplicáveis recebem `[N/A] — motivo curto`. Itens marcados como `[ ]` bloqueiam merge.

```markdown
## Definition of Done — Lex (19 itens)

### Núcleo técnico
- [ ] 01. Lint + typecheck + build verdes (`pnpm lint && pnpm typecheck && pnpm build`)
- [ ] 02. Testes unit/integration cobrindo o caminho feliz **e** ≥ 1 caminho de erro
- [ ] 03. Migrations Prisma reversíveis (forward + plano de rollback declarado)
- [ ] 04. Sem secrets, sem `console.log` em prod paths, sem TODO sem owner
- [ ] 05. Multi-tenant: toda query nova filtra por `workspaceId` ou justifica server-side com referência ao path

### Qualidade jurídica e IA
- [ ] 06. Mudança em IA/retrieval/chunker/embedding rodou suíte de benchmark e comparou métricas vs baseline (`scripts/cf-retrieval-smoke.ts`, `scripts/retrieval-smoke.ts`, `scripts/cf-coverage-audit.ts`, `scripts/legal-retrieval-domains-qa.ts`, conforme escopo)
- [ ] 07. Toda saída IA exposta ao usuário tem **fonte citável** (`groundingScore`, `usedSources`, `usedChunks`) ou bloqueio de export quando insuficiente
- [ ] 08. Sem placeholders ("[descrever]", "[fundamentar]") no output IA destinado ao usuário final
- [ ] 09. Anti-hallucination: regras de `drafting-guard.ts` + `source-sufficiency.ts` aplicáveis foram revisadas (ou explicitado N/A)

### Segurança e LGPD
- [ ] 10. RBAC: rotas/server actions exigem role mínima conforme `src/lib/auth/permissions.ts`; admin gating server-side **não** apenas hide-on-menu
- [ ] 11. Logs respeitam `src/lib/format/pii.ts` (PII removida/mascarada) e não expõem segredos
- [ ] 12. Headers de segurança preservados em `next.config.ts` quando rota nova é adicionada
- [ ] 13. Para mudança em LGPD/memória/storage: política de retenção + base legal declaradas

### UX e produto
- [ ] 14. Estados loading/empty/error implementados em qualquer tela nova ou alterada
- [ ] 15. Linguagem para o advogado (sem jargão dev visível): mensagens de erro, labels e CTAs revisadas
- [ ] 16. Trust UX: quando há geração IA, transparência (origem, score, fontes) renderizada de forma legível

### Observabilidade, custo e operação
- [ ] 17. Métricas/eventos relevantes adicionados (`recordObservabilityLog`, `CaseTimelineEvent`, `fallbackFlags`); dashboards atualizados (ou tarefa criada)
- [ ] 18. Custo IA estimado declarado na PR para mudanças que tocam IA/retrieval/embeddings; sem regressão > banda em `EXECUTION_BUDGETS`
- [ ] 19. Plano de rollback declarado em referência a [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md), com comando/PR de reverso pronto
```

---

## 2. Detalhamento por item

### Núcleo técnico

**01. Lint + typecheck + build verdes**
- Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Cobertura: zero erros e zero warnings críticos. Warnings de bundle/cache devem ser justificados.
- Owner: autor.

**02. Testes**
- Unit (`*.test.ts(x)`): qualquer função pura nova; mudança em `src/lib/**/*.ts` sensível a regras.
- Integration (`tests/**`): para fluxo que cruza ≥ 2 módulos (ex.: drafting → review).
- Caminho feliz **e** ≥ 1 caminho de erro (auth ausente, payload inválido, fallback acionado).
- Owner: autor; reviewer: QA Lead em Tier-S/A.

**03. Migrations Prisma reversíveis**
- Toda migration em `prisma/migrations/**` deve ser **backwards-compatible** em **release N**: adicionar coluna nullable, criar índice CONCURRENTLY (quando suportado), deprecar coluna em release N+1, remover em release N+2.
- Plano de rollback declarado: ou `down.sql`, ou comando manual descrito, ou PR de reverso pronto.
- Owner: banco owner; reviewer: CTO.
- Ver `docs/architecture/DATA_MIGRATION_POLICY.md` (a criar em F2).

**04. Higiene de código**
- `git diff` não introduz: secrets (chaves API, tokens), `console.log` em paths fora de scripts/dev, novos `TODO`/`FIXME` sem `owner=` no comentário.
- Owner: autor; reviewer: CTO.

**05. Multi-tenant scoping**
- Toda nova query (`prisma.X.find*`, `update*`, `delete*`) filtra por `workspaceId` ou usa helper que o garante.
- Workspace é resolvido via `resolveWorkspaceId` (ver `src/lib/auth/workspace.ts`) ou cookie validado.
- Exceção exige justificativa explícita no PR + aprovação Security Lead.
- Owner: autor; reviewer: Security Lead.

### Qualidade jurídica e IA

**06. Benchmark obrigatório em mudanças de IA/retrieval**
- Subsystems aplicáveis: `IA`, `retrieval`, `rerank`, `chunking`, `embeddings`.
- Suítes: `pnpm cf:retrieval:smoke`, `pnpm retrieval:smoke`, `pnpm cf:coverage:audit`, `pnpm legal-retrieval:domains-qa` (e/ou subset relevante).
- Comparar com baseline da última release `stable`. Regressão > banda definida em `QUALITY_THRESHOLDS.md` exige RFC + override.
- Owner: subsystem owner; reviewer: QA Lead.

**07. Fonte citável em todo output IA**
- Resposta de retrieval: payload contém `usedSources`, `usedChunks`, `groundingScore`, `confidence`.
- Geração de peça: `Draft` referencia `ApprovedLegalFoundation` ou pinned sources; bloqueio de export quando `groundingScore < threshold` aplicável.
- Owner: autor; reviewer: Legal Lead.

**08. Sem placeholders no output do usuário**
- Regex grep no diff: `\[descrever\]`, `\[fundamentar\]`, `\[lorem\]`, `<TODO>`, `\.\.\.[ ]+` em prompts/templates de saída.
- Owner: autor; reviewer: Legal Lead em Tier-S.

**09. Anti-hallucination**
- Mudanças em `drafting.ts`, `drafting-guard.ts`, `source-sufficiency.ts`, `review.ts`, `intake.ts` exigem revisão das regras de bloqueio e teste com prompt adversarial conhecido.
- Owner: workflow jurídico owner; reviewer: Legal Lead.

### Segurança e LGPD

**10. RBAC server-side**
- Permissões check via `can(role, permissionKey)` (ver `src/lib/auth/permissions.ts`) **antes** de queries sensíveis.
- Admin/observability views: gating server-side; esconder do menu não conta.
- Owner: autor; reviewer: Security Lead.

**11. PII e secrets em logs**
- Logger usa `redactPII` ou equivalente em `src/lib/format/pii.ts`.
- Spot-check: revisar logs novos em PRs que tocam `src/lib/logger.ts`, `src/lib/observability/**`, ou rota nova com `console`/`logger`.
- Owner: autor; reviewer: LGPD owner.

**12. Headers de segurança**
- Rota nova respeita CSP/CORS/Cache-Control declarados em `next.config.ts`.
- Owner: autor; reviewer: Security Lead.

**13. Política de retenção**
- Memória, storage, anexos: declarar `retention` (dias) e base legal LGPD aplicável.
- Owner: LGPD owner; reviewer: Legal Lead.

### UX e produto

**14. Loading/Empty/Error**
- Toda nova tela (Page) ou componente que dispara fetch tem 3 estados explícitos.
- Erro deve ser **legível ao advogado** (não JSON cru, não stack trace).
- Owner: UX owner; reviewer: PO.

**15. Linguagem para o advogado**
- Não introduzir termos como "embedding", "vector", "chunk", "índice vetorial interno", "Inngest job", "Qdrant", "Redis", "DLQ" em UI exceto em `/observability` (admin).
- Mensagens de erro humanizadas com próxima ação sugerida.
- Owner: UX owner; reviewer: PO.

**16. Trust UX**
- Componentes em `src/components/trust/*` renderizados quando há geração/sugestão IA: origem (ex.: "CF/88 Art. 5º"), grounding score (badge), fontes acessíveis (drawer/modal).
- Owner: UX owner; reviewer: Legal Lead.

### Observabilidade, custo e operação

**17. Métricas e eventos**
- Eventos jurídicos relevantes registrados em `CaseTimelineEvent`.
- Eventos técnicos via `recordObservabilityLog` ou logger estruturado; `fallbackFlags` preservados no trace de retrieval.
- Owner: observabilidade owner; reviewer: CTO.

**18. Custo IA**
- PR que toca IA/retrieval/embeddings declara estimativa de impacto de custo (∆ chamadas/req, ∆ tokens, ∆ $/1k chamadas).
- Sem regressão acima da banda definida em `EXECUTION_BUDGETS.md` (Leva 2).
- Owner: IA owner; reviewer: CTO.

**19. Plano de rollback**
- Toda PR Tier-S/A declara como reverter, citando playbook em [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md).
- Para schema: PR de reverso já redigido (mesmo que não mergeado).
- Para retrieval/IA: cite o flag/env var de toggle.
- Owner: autor; reviewer: CTO.

---

## 3. Critérios de "Done" por estado

| Estado | O que o usuário enxerga | DoD aplicável |
|--------|-------------------------|----------------|
| **Hidden behind flag** | Nada (feature off) | 01..05, 17, 19 |
| **Internal alpha** (workspace dev) | Time interno usa | 01..09, 10..13, 17..19 |
| **Beta** (clientes piloto) | Cliente vê com `beta` badge | Todos os 19 |
| **GA** (anúncio público) | Cliente vê sem badge | Todos os 19 + assinatura PO + Legal/Security conforme tier |

---

## 4. Definition of "Stable"

Após **14 dias** corridos pós-merge:

- Sem regressão de métrica chave (ver `QUALITY_THRESHOLDS.md`).
- Sem incidente Tier-S relacionado.
- Sem rollback executado.
- Sem ticket aberto pelo time de suporte vinculado à mudança.

Atende → release marcado `stable` e habilita refactor pós-feature dentro de `EXECUTION_BUDGETS`.

---

## 5. Override

Override de qualquer item exige:

1. Justificativa no PR (`DoD-override: <item> — motivo`).
2. Assinaturas: PO + CTO + (Legal/Security/QA conforme natureza do item).
3. Registro em `OVERRIDES_LOG.md`.
4. Revisão em até 30 dias.

Override frequente (≥3 em trimestre) sobre o **mesmo** item dispara revisão da regra (não tolerância).

---

## 6. Como evoluir este checklist

- Itens só são adicionados/removidos por **RFC** + assinaturas PO + CTO + QA Lead.
- Versão do checklist é incrementada (`v1.0` hoje); PRs em voo no momento da mudança continuam no checklist anterior até merge.

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md), [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md), [`RELEASE_GATES.md`](RELEASE_GATES.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md), [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) (Leva 2), [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md) (Leva 2).
