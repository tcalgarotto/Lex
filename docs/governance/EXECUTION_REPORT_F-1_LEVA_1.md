---
title: Execution Report — F-1 Leva 1
status: published
owners: [PO, CTO]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/PRIORITY_MATRIX.md
  - docs/governance/OWNER_MATRIX.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/DEFINITION_OF_DONE.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/ROLLBACK_POLICY.md
  - /home/thales/.cursor/plans/lex_master_documentation_plan_9a6a48df.plan.md
tier: mvp
---

# Execution Report — F-1 Leva 1

> **Escopo executado**: criação da camada de governance operacional do Lex em `docs/governance/`. **Sem** alteração de código, retrieval, UI ou config.
>
> **Princípio aplicado**: estabilizar > consolidar > validar > medir > benchmarkar > endurecer **antes** de expandir. Esta Leva 1 não toca produto; instala disciplina.

---

## 1. Sumário executivo

### 1.1 Entregas (Leva 1)

| # | Documento | Status | Linhas |
|---|-----------|--------|--------|
| 1 | [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) | criado | regra-mestra de execução, RACI, RFC mínima, cadência, override |
| 2 | [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md) | criado | P0–P4 + classificação inicial de ~70 features |
| 3 | [`OWNER_MATRIX.md`](OWNER_MATRIX.md) | criado | 25 subsystems × 8 campos com tier-S/A/B/C |
| 4 | [`RELEASE_GATES.md`](RELEASE_GATES.md) | criado | gates G-01..G-80 por estágio + tier |
| 5 | [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) | criado | 19 itens obrigatórios + estados (alpha/beta/GA/stable) |
| 6 | [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md) | criado | gatilhos S-01..S-44 + remediation lane |
| 7 | [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md) | criado | playbooks por subsystem (peça/retrieval/embedding/chunker/prompt/schema/UX/integração/Inngest/auth/Vercel) |
| 8 | **Este relatório** | criado | inconsistências roadmap × código × docs |

### 1.2 Não executado nesta Leva (e proibido começar sem checkpoint explícito)

- Nenhuma alteração em código (`src/**`, `prisma/**`, `scripts/**`, `tests/**`).
- Nenhuma alteração em UI / retrieval / embeddings / chunker.
- Nenhuma execução de migração ou job.
- Nenhuma promoção de versão / release.

### 1.3 Próximos checkpoints (sequência sugerida; aguardando aprovação explícita do PO + CTO)

1. **F-1 Leva 2**: criar 6 docs estendidos (`PRODUCT_SURVIVAL_MODE`, `QUALITY_THRESHOLDS`, `TRUTH_HIERARCHY`, `FORBIDDEN_ORDERINGS`, `EXECUTION_BUDGETS`, `ARCHITECTURE_STABILITY_POLICY`) + `BENCHMARK_STRATEGY.md`.
2. **F0 Auditoria** começa apenas após Leva 2 mergeada e as **5 assinaturas** de §13 do `EXECUTION_GOVERNANCE.md`.
3. F1..F10 seguem ordem do `MASTER_ROADMAP.md` (a ser publicado em F0/F1).

---

## 2. Metodologia desta auditoria

- **Escopo**: roadmap v3.2 (plano em `/home/thales/.cursor/plans/lex_master_documentation_plan_9a6a48df.plan.md`) × código real do repositório × documentação existente em `docs/**` × scripts em `package.json`.
- **Fontes consultadas**:
  - `README.md` (raiz), `package.json`, `vercel.json`.
  - `prisma/schema.prisma` + 22 migrations em `prisma/migrations/**`.
  - `src/lib/auth/{permissions,workspace,session,sync-user,invitations}.ts`.
  - 65 rotas em `src/app/api/**/route.ts`.
  - 39 páginas em `src/app/**/page.tsx`.
  - 32 scripts em `scripts/**`.
  - Lista de docs em `docs/**` (incluindo audits P0 já produzidos: `CODE_REVIEW_P0.md`, `COMMERCIAL_UX_P0_AUDIT.md`, `P0_COMMERCIAL_RELEASE_REPORT.md`, `SECURITY_REVIEW_P0.md`, `RETRIEVAL_PIPELINE_AUDIT.md`, `DEEPINFRA_EMBEDDING_AUDIT.md`).
- **Critério**: registrar **divergência** (roadmap/doc → código), **omissão** (existe no código, ausente no roadmap), **risco** (governança pendente), **inconsistência interna de doc** (referências que não se sustentam), e **alinhamento confirmado** (importante registrar para evitar retrabalho).
- **Severidade**:
  - **Crítica (S-CRT)**: bloqueia release ou cria risco material.
  - **Alta (S-ALT)**: degrada confiança ou exige correção próxima.
  - **Média (S-MED)**: tecla a ser ajustada na próxima janela.
  - **Baixa (S-BAI)**: melhoria de higiene.
- **Escopo de remediação**: nenhum item é corrigido nesta Leva. Cada item gera tarefa no F0 (auditoria detalhada) ou F1 (consolidação).

---

## 3. Inventário rápido (estado real do código em 2026-05-09)

| Métrica | Valor real | Observação |
|--------:|-----------:|------------|
| Páginas (`src/app/**/page.tsx`) | **39** | inclui (auth) + (app) + (marketing) + onboarding/invite |
| Rotas API (`src/app/api/**/route.ts`) | **65** | inclui webhook Inngest, health/ready, integrações |
| Migrations Prisma | **22** | 7 maio + 13 entre 7-9 maio (lex_corpus, soft_delete, library_foundations, office_memory, etc.) |
| Scripts em `package.json` | **32** entradas | + 32 arquivos em `scripts/**` (alinhado, ver §5) |
| Roles `MembershipRole` | **5** (OWNER 100, ADMIN 80, LAWYER 60, ASSISTANT 40, CLIENT 20) | `src/lib/auth/permissions.ts` |
| Permissões nomeadas em `permissions.ts` | **15** | inclui workspaceManage/Delete, billingManage, observabilityView |
| Tribunais catalogados | **92** | `5 + 6 + 24 + 27 + 27 + 3` (Sup., TRFs, TRTs, TJs, TREs, TJMs) |
| Adapters de integração | **PJe, eSAJ, Projudi, eproc, DOU/DJE, email, WhatsApp, calendar, webhook genérico** | em `src/lib/integrations/**` |

---

## 4. Inconsistências entre `README.md` e código real

### 4.1 [S-ALT] `README.md` declara redirects que coexistem com páginas reais

- README §"Rotas principais" diz: `/biblioteca → /pesquisa-juridica?scope=legislacao`. Porém existem páginas reais:
  - `src/app/(app)/biblioteca/page.tsx`
  - `src/app/(app)/biblioteca/memoria/page.tsx`
  - `src/app/(app)/biblioteca/fundamentos/novo/page.tsx`
  - `src/app/(app)/biblioteca/fundamentos/[id]/page.tsx`
- README também diz `/retrieval → /pesquisa-juridica`. Mas há `src/app/(app)/retrieval/page.tsx` e `src/app/(app)/retrieval/explain/page.tsx`.
- **Risco**: o usuário (e o desenvolvedor) tem dois mapas mentais conflitantes; SEO interno e analytics ficam ambíguos.
- **Ação proposta (F0)**: decidir entre (a) consolidar em `/pesquisa-juridica` e remover páginas `/biblioteca/**` e `/retrieval/**`; ou (b) atualizar README para refletir que ambas existem com escopos distintos. Registrar em `DOC_VS_CODE_DIVERGENCE.md`.

### 4.2 [S-ALT] README cita `LegalSource` e `db:seed` após o DROP do modelo

- README §"Scripts úteis" warns: *"Nota: rodar `db:seed` duas vezes duplica fontes em `LegalSource`."*
- A migration `prisma/migrations/20260508130000_drop_legal_source/migration.sql` **droppou** a tabela legacy `LegalSource`.
- O modelo `CaseLegalSource` (diferente, ainda em uso para vincular norma a caso) confunde a leitura.
- **Risco**: dev novo procura `LegalSource` e fica perdido; doc gera dúvida de "o que sobrou da migração".
- **Ação proposta (F0)**: reescrever a nota explicando que o `LegalSource` legacy foi removido; substituir referência por modelo canônico `LegalNorm`/`LegalNormVersion`/`LegalChunk`/`LegalCitation`. Mencionar `CaseLegalSource` como entidade distinta (case ↔ norma).

### 4.3 [S-ALT] README aponta scripts inexistentes em `package.json`

| Script citado no README | Existe em `package.json`? |
|--------------------------|---------------------------|
| `npm run ingest:corpus` (referência: `seed/ingest-corpus.ts`) | **Não** (script ausente; pasta `seed/` inexistente) |
| `npm run seed:demo-legal` (cria processo demo realista + indexa) | **Não** (script ausente; arquivo `scripts/seed-demo-legal*` inexistente) |

- **Risco**: roteiro de demo (`README §"Demonstração comercial"`) **não roda** porque depende de `seed:demo-legal`.
- **Ação proposta (F0)**: decidir se esses scripts são reintroduzidos ou se README é atualizado. Marcar como **bloqueador de demonstração comercial** até resolver.

### 4.4 [S-MED] README diz `vercel.json` configura "cron de health check"; arquivo não tem `crons`

- `vercel.json` real:

```1:21:vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "git": {
    "deploymentEnabled": {
      "main": true,
      "master": true
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0" }
      ]
    }
  ]
}
```

- **Risco**: time pensa que tem health-check-cron Vercel; produção fica dependente de uptime monitor externo (README orienta isso, mas a frase do §Deploy passa expectativa errada).
- **Ação proposta (F0)**: ou adicionar `crons` em `vercel.ts` (a usar `@vercel/config`, padrão atual da plataforma), ou corrigir README para remover a promessa.

### 4.5 [S-MED] README §Arquitetura cita pastas inexistentes

- README diz: *"`src/lib/repositories` — Prisma / adaptadores"*.
- Pasta `src/lib/repositories/**` **não existe**.
- **Risco**: novo dev tenta seguir o mapa e não acha as camadas; doc enviesa decisão arquitetural que nunca aconteceu.
- **Ação proposta (F0)**: ajustar README para refletir realidade (`src/lib/cases/**`, `src/lib/corpus/**`, `src/lib/retrieval/**`, `src/lib/auth/**`, etc.), **ou** decidir adotar o padrão e abrir RFC para refactor.

### 4.6 [S-MED] README §"Smoke flow" e §"Demonstração comercial" usam `/processos`, mas UX_FLOW_AUDIT empurra caso-cêntrico

- `README` §Smoke começa em `/processos` e abre processo → docs/chat/peças (modelo legacy "documentos por processo").
- `README` §Rotas principais diz que o produto é **caso-cêntrico** e cita `/cases` como navegação primária.
- `docs/UX_FLOW_AUDIT.md` (referido no README) consolida a jornada caso → documento → pesquisa → peça → revisão → export.
- Coexistem dois roteiros incompatíveis no mesmo README.
- **Risco**: roteiro de demo confunde o advogado e contradiz a tese do produto; analytics não consegue medir uma única "jornada feliz".
- **Ação proposta (F0)**: alinhar README/docs num único roteiro caso-cêntrico. Mover roteiro processo-cêntrico para `docs/legacy/` ou removê-lo.

### 4.7 [S-BAI] README não cita várias páginas reais como `/onboarding`, `/test-guide`, `/settings/{readiness,roteiros,estilo}`, `/apresentacao`, `/demo`, `/(marketing)/{manifesto,pricing}`

- Discrepância entre o "menu primário" listado no README e as 39 páginas existentes.
- **Risco**: navegação real do app não se reflete no doc; testes E2E não cobrem páginas "esquecidas".
- **Ação proposta (F0)**: produzir o `MASTER_INDEX.md` com mapa completo de páginas categorizadas (advogado / admin / dev / marketing / onboarding) — entrega prevista no plano v3.2 §Parte E.

---

## 5. Inconsistências entre roadmap (plano v3.2) e código real

### 5.1 [S-ALT] Plano referencia `LAWYER_MEMORY_LIVING.md` e roteiros de memória; código já tem migration `office_memory`

- Migration `prisma/migrations/20260509220000_office_memory/migration.sql` **existe** (criada em 2026-05-09 14:00 UTC, mesmo dia do plano).
- Plano v3.2 lista memória do escritório como "P1 partial" — alinhado.
- **Risco**: plano + código convergem, mas falta documentar **estado da migração** (campos, retenção LGPD, opt-in) em `docs/security/LGPD.md` e `docs/features/MEMORY.md`. Sem doc, governance não consegue assinar `DoD-13`.
- **Ação proposta (F0)**: detalhar migration office_memory em doc dedicada antes de promover a feature em UI.

### 5.2 [S-MED] Migrations: 22 reais vs alguns docs/menções "24"

- Real: **22 migrations** em `prisma/migrations/**` (datadas 2026-05-07 a 2026-05-09).
- Documentação tangencial menciona "24" (em audits anteriores) — não há fonte oficial; potencialmente desatualizada após drop da `LegalSource`.
- **Risco**: baixo, mas governança exige fonte canônica. `MASTER_INDEX.md` (F0) deve consolidar.
- **Ação proposta (F0)**: padronizar sumário de migrations em `docs/architecture/DATA.md`.

### 5.3 [S-MED] Plano descreve API surface "60+" rotas; real são 65

- Real: **65 rotas** em `src/app/api/**/route.ts`.
- Plano v3.2 fala em "API surface" como dimensão de auditoria.
- Não há contradição direta, mas **o número exato precisa ser fixado** em `MASTER_INDEX.md` e `OWNER_MATRIX` por subsystem.
- **Ação**: já corrigido em [`OWNER_MATRIX.md §3 APIs`](OWNER_MATRIX.md) (3.14) — ficou explícito "65 rotas em 2026-05-09".

### 5.4 [S-MED] STJ provider: README descreve `scaffold com extractor pluggable`; roadmap trata STJ como integração viva

- `README` §Cobertura nacional: STJ → `StjCorpusProvider` (scaffold com extractor pluggable).
- Roadmap discute jurisprudência como input para `LegalNorm` jurisprudencial; STJ aparece como tier P1 (jurisprudência + súmulas).
- **Risco**: features que dependem de jurisprudência STJ (busca enriquecida, alertas de mudança de tese) podem ser anunciadas antes de o adapter estar real.
- **Ação proposta (F0)**: marcar STJ como `partial` em `PRIORITY_MATRIX §4`; bloquear promessa pública dependente até adapter live.

### 5.5 [S-MED] DataJud: README orienta `datajud:check`; precisa API key CNJ; status de operação não publicado

- Script `scripts/datajud-check.ts` existe.
- Provider `DatajudCorpusProvider` cobre TRFs/TRTs/TREs/TJs/TJMs — **requer API key CNJ**.
- README §Cobertura nacional não diz se o key está provisionado, em que ambientes, custo.
- **Risco**: time supõe cobertura nacional ativa quando provavelmente está em modo "scaffold" para a maioria dos tribunais.
- **Ação proposta (F0)**: documentar em `docs/integrations/DATAJUD.md` (já existe `docs/DATAJUD_SETUP.md` — consolidar/atualizar) o estado real (com/sem key, planos de cobertura).

### 5.6 [S-MED] `qa:retrieval:domains` vs `legal-retrieval:domains-qa` — naming divergente no plano

- `package.json`: `qa:retrieval:domains → scripts/legal-retrieval-domains-qa.ts`.
- O plano v3.2 cita `legal-retrieval:domains-qa` em alguns trechos e `qa:retrieval:domains` em outros.
- Os documentos da Leva 1 fixaram o nome correto (`pnpm qa:retrieval:domains` ou `tsx scripts/legal-retrieval-domains-qa.ts`).
- **Ação**: nomes oficiais validados nesta Leva; reforçar em `BENCHMARK_STRATEGY.md` (Leva 2).

### 5.7 [S-ALT] Roadmap exige "admin gating server-side"; código tem permissões mas falta auditoria de cobertura

- `src/lib/auth/permissions.ts` define `observabilityView` e `billingManage` com `role === OWNER`.
- Não há, neste momento, evidência objetiva de que **todas** as rotas `/observability`, `/admin`, `/cockpit` (e suas APIs) estão guardadas server-side com `can(role, 'observabilityView')` antes de leitura sensível.
- **Risco**: `S-13`/`S-10` estão **armed** mas não temos certeza de que o produto cumpre G-19.
- **Ação proposta (F0 + F4 Security)**: produzir `docs/security/RBAC_COVERAGE_MATRIX.md` mapeando rota → permission check; **antes** de F1 começar.

### 5.8 [S-ALT] Plano cita `BENCHMARK_STRATEGY.md`, `EXECUTION_BUDGETS.md`, `ARCHITECTURE_STABILITY_POLICY.md`, `PRODUCT_SURVIVAL_MODE.md`, `QUALITY_THRESHOLDS.md`, `TRUTH_HIERARCHY.md`, `FORBIDDEN_ORDERINGS.md` — pendentes para Leva 2

- Os documentos da Leva 1 referenciam esses 7 documentos como **dependências**.
- Sem eles, gates como **G-72/G-73** (custo IA), **S-05** (custo), **S-41** (overrides), §6.1 (cadência de benchmark), §7 (anti-padrões) ficam sem **threshold numérico**.
- **Risco**: governance Leva 1 é executável textualmente, mas alguns números precisos exigem Leva 2.
- **Ação**: aprovar checkpoint para iniciar Leva 2 imediatamente após sign-off da Leva 1.

### 5.9 [S-MED] Plano fala em LGPD doc + DPA; nenhum existe em `docs/`

- `docs/SECURITY.md` e `docs/SECURITY_REVIEW_P0.md` existem; **não há** `docs/security/LGPD.md` nem template DPA.
- **Risco**: anunciar Pro/Enterprise sem LGPD doc fere `FORBIDDEN_ORDERINGS §10`.
- **Ação proposta (F4 Security)**: produzir `docs/security/LGPD.md` + `docs/security/DPA_TEMPLATE.md` + `docs/security/RETENTION_POLICY.md`.

### 5.10 [S-MED] Plano cita `next-actions.ts` (UX inteligente) — confirmado existente

- `src/lib/dashboard/next-actions.ts` existe.
- Estado em `PRIORITY_MATRIX §4` está correto: P1 partial.
- **Sem ação**; registro de alinhamento.

---

## 6. Inconsistências internas em `docs/**`

### 6.1 [S-MED] Audits P0 já existentes não estão indexados pelo plano

Documentos existentes em `docs/`:

- `P0_COMMERCIAL_RELEASE_REPORT.md`
- `COMMERCIAL_UX_P0_AUDIT.md`
- `SECURITY_REVIEW_P0.md`
- `CODE_REVIEW_P0.md`
- `RETRIEVAL_PIPELINE_AUDIT.md`
- `DEEPINFRA_EMBEDDING_AUDIT.md`
- `UX_FLOW_AUDIT.md`
- `DRAFTING_REVIEW_FLOW.md`
- `CASE_BRAIN.md`
- `RAG_ARCHITECTURE.md`
- `COLBERT_LEGAL_RETRIEVAL.md`

- O plano v3.2 não os referencia explicitamente nas seções de auditoria F0/F4. Há risco de retrabalho ("auditar de novo o que já foi auditado").
- **Risco**: governança duplicada; perda de evidência prévia.
- **Ação proposta (F0)**: incluir esses docs como **input** das auditorias F0/F4 e marcar achados que ainda valem como **baseline**.

### 6.2 [S-MED] `docs/COLBERT_LEGAL_RETRIEVAL.md` versus pipeline real (BM25 + Dense + RRF + rerank, **sem** ColBERT)

- README §"Retrieval jurídico enterprise" descreve pipeline atual: BM25 + Dense + RRF + (opcional) Graph + Rerank — **sem ColBERT**.
- Doc `COLBERT_LEGAL_RETRIEVAL.md` provavelmente reflete intenção/pesquisa, não estado vigente.
- **Risco**: leitor entende que ColBERT está em prod; expectativa de qualidade equivocada.
- **Ação proposta (F0/F2)**: marcar `status: planned` no doc e referenciar em `DOC_VS_CODE_DIVERGENCE.md`. Decidir em F2 se entra (RFC).

### 6.3 [S-BAI] `docs/audits/`, `docs/reports/`, `docs/subagents/` existem mas não há `MASTER_INDEX.md`

- Ausência de índice canônico aumenta probabilidade de doc novo desconhecer doc antigo.
- **Ação proposta (F1)**: produzir `docs/MASTER_INDEX.md` (entrega prevista no plano).

### 6.4 [S-MED] Existem 2 documentos competindo por status de release P0

- `docs/P0_COMMERCIAL_RELEASE_REPORT.md`
- `docs/COMMERCIAL_UX_P0_AUDIT.md`

A relação entre ambos não está formalizada. `RELEASE_GATES` (este pacote) propõe um único path G-50..G-58 + G-60..G-63 + G-70..G-73. Convergir.

- **Ação proposta (F0)**: registrar relação (ex.: `COMMERCIAL_UX_P0_AUDIT` é insumo, `P0_COMMERCIAL_RELEASE_REPORT` é o checkpoint), ou consolidar.

---

## 7. Riscos de governança identificados na Leva 1

| ID | Risco | Severidade | Mitigação imediata | Doc relacionado |
|----|-------|------------|---------------------|------------------|
| GOV-01 | OWNER_MATRIX preenchido com `_a preencher_` em **todas** as células de pessoa | S-ALT | PO+CTO preenchem antes de F0; bloqueia início de auditorias | `OWNER_MATRIX.md` |
| GOV-02 | Bus factor não medido | S-ALT | Após nomes preenchidos, computar e registrar em `HEALTH_METRICS.md` (F1) | `OWNER_MATRIX.md`, `EXECUTION_GOVERNANCE.md` §11 |
| GOV-03 | Stop conditions ainda não conectadas a métricas reais | S-MED | F1 conecta gatilhos S-01..S-25 a logger / Langfuse / scripts | `STOP_CONDITIONS.md` |
| GOV-04 | Release gates dependem de scripts existentes mas sem orquestração CI | S-MED | F6 publica workflows GitHub Actions plugando os scripts | `RELEASE_GATES.md` §8 |
| GOV-05 | Override log inexistente — primeiro override criará o arquivo | S-BAI | Aceitável; documentado | `EXECUTION_GOVERNANCE.md` §10, `RELEASE_GATES.md` §7 |
| GOV-06 | `INCIDENT_LOG.md` e `POSTMORTEM_TEMPLATE.md` referenciados não existem ainda | S-MED | F1 cria templates | `ROLLBACK_POLICY.md` §5/§6 |
| GOV-07 | Janelas de freeze e cycles não calendarizadas | S-MED | F0 publica calendário operacional 2026 H2 | `EXECUTION_GOVERNANCE.md` §6 |
| GOV-08 | Definition of Stable depende de `QUALITY_THRESHOLDS.md` (Leva 2) para "métrica chave" | S-MED | Aceitável; referência cruzada presente | `DEFINITION_OF_DONE.md` §4 |
| GOV-09 | Roadmap v3.2 não tem ainda `MASTER_ROADMAP.md` publicado em `docs/` | S-ALT | F1 publica roadmap como doc de produto, sincronizado com `PRIORITY_MATRIX.md` | `PRIORITY_MATRIX.md` §4 |
| GOV-10 | Sem PR template, gates dependem de disciplina manual | S-MED | F6 entrega `.github/PULL_REQUEST_TEMPLATE.md` com DoD + RFC + tier | `DEFINITION_OF_DONE.md` §1 |

---

## 8. Riscos de produto / código já visíveis sem auditoria detalhada

> Estes itens **não** foram inspecionados linha-a-linha; são sinais identificados durante a leitura para governance. F0 deve confirmá-los.

1. **[S-ALT] Cobertura multi-tenant** (`workspaceId`) — provável mas não auditada por `RBAC_COVERAGE_MATRIX`. Risco IDOR latente. Vinculado a §5.7 e gate G-19.
2. **[S-ALT] PII em logs** — `src/lib/format/pii.ts` existe; não há evidência de auditoria recente sobre logs novos pós-`office_memory` migration.
3. **[S-ALT] `scope: drafting + grounding`** — `drafting-guard.ts` + `source-sufficiency.ts` existem; carecem de **gold-set adversarial** publicado para benchmark contínuo (gate G-50..G-55, S-03).
4. **[S-MED] Custos IA** sem cap declarado por workspace; gate S-05 sem threshold numérico até Leva 2.
5. **[S-MED] Rerank ON por padrão** sem A/B documentado vs OFF. Toggle existe (ver `ROLLBACK_POLICY §4.3`); falta playbook de validação periódica.
6. **[S-MED] Prazos / calendário** descritos como `planned`/`partial`; UI no produto pode dar dead-end (S-30) — confirmar em F0 com smoke G-57.
7. **[S-MED] WhatsApp ingest live** referenciado no README como adapter; produção exige LGPD + secrets — não promover sem `S-14` ack.
8. **[S-BAI] `docs/UX_INSPIRATION_NOTES.md`** referenciado no README mas não confirmado neste relatório (não foi lido); validar em F0.

---

## 9. Resumo por tier de severidade

| Severidade | Quantidade | IDs |
|-----------:|-----------:|-----|
| S-CRT (crítica) | 0 | — |
| S-ALT (alta) | 8 | §4.1, §4.2, §4.3, §5.1, §5.7, §5.8, §6 (não classificado), §8.1–§8.3, GOV-01, GOV-02, GOV-09 |
| S-MED (média) | 13 | §4.4, §4.5, §4.6, §5.2, §5.3, §5.4, §5.5, §5.6, §5.9, §6.1, §6.2, §6.4, §8.4–§8.7 |
| S-BAI (baixa) | 3 | §4.7, §6.3, §8.8 |

> Nenhum item crítico foi descoberto **na governança**; isso não significa ausência de risco crítico **no produto** — significa que precisamos rodar F0 (auditoria detalhada) com a governança no lugar para encontrá-los e tratá-los com disciplina.

---

## 10. Decisões registradas durante esta Leva

| ID | Decisão | Justificativa | Quem decide ratificação |
|----|---------|----------------|--------------------------|
| DEC-01 | OWNER_MATRIX inclui 25 subsystems (não 23, não 30); 5 papéis funcionais (PO/CTO/Legal/Security/QA) | Cobre estado atual sem inflar; bus-factor exigido em Tier-S/A | PO + CTO |
| DEC-02 | Tiers de prioridade são **5** (P0..P4) — não 4, não 6 | Cobre absolute blocker, core comercial, premium, enterprise, ecossistema | PO + CTO |
| DEC-03 | DoD tem **19 itens**; itens não-aplicáveis exigem `N/A: motivo`, não silêncio | Disciplina sem inchar checklist | PO + CTO + QA |
| DEC-04 | Release gates: G-01..G-80 organizados por estágio; tier mínimo declarado | Permite checagem mecânica + manual com clareza | CTO + QA |
| DEC-05 | Stop conditions S-01..S-44 em 5 grupos (qualidade IA / segurança / estabilidade / produto / governança) | Mapa exaustivo do que pode forçar parada | PO + CTO + Security + Legal + QA |
| DEC-06 | Rollback Policy com playbook por subsystem **e** por tipo (toggle/revert/redeploy/restore) | Evita "improvisação em prod" | CTO + Owners |
| DEC-07 | Pasta `docs/governance/` é **canônica**; entradas em outros docs sobre governance se subordinam | Evita 2 fontes de verdade | PO + CTO |
| DEC-08 | Esta Leva **não** corrige inconsistências encontradas; apenas registra | Mantém escopo de governance pura | PO + CTO |

---

## 11. Riscos do próprio relatório (auto-crítica)

- **R-1**: amostragem de evidência foi por leitura cruzada de README + schema + paths; pode ter omitido inconsistências em código profundo (`src/lib/**`). F0 expandirá.
- **R-2**: contagens (39 páginas, 65 rotas, 22 migrations, 32 scripts, 92 tribunais) são snapshots de 2026-05-09; precisam virar **rotina diária** em `HEALTH_METRICS.md`.
- **R-3**: nomes de owners ficam pendentes; se PO/CTO atrasarem o preenchimento, gates ficam textuais (sem enforcement).
- **R-4**: thresholds numéricos pendem da Leva 2; até lá, "regressão" e "banda" são qualitativos.
- **R-5**: este relatório **não** substitui auditorias por subsystem (`AUDIT_*.md` previstas em F0).

---

## 12. Recomendações finais para o checkpoint

> **Esta seção é o que deve ser lido pelo PO + CTO antes de aprovar o início de F-1 Leva 2 e/ou F0.**

1. **Aprovar formalmente** o pacote de governance Leva 1 (8 docs) — assinaturas em `EXECUTION_GOVERNANCE.md §13`.
2. **Preencher `OWNER_MATRIX.md`** (todas as células `_a preencher_`) **hoje**; sem isso, gate G-03 trava qualquer PR.
3. **Aprovar Leva 2** (PRODUCT_SURVIVAL_MODE, QUALITY_THRESHOLDS, TRUTH_HIERARCHY, FORBIDDEN_ORDERINGS, EXECUTION_BUDGETS, ARCHITECTURE_STABILITY_POLICY, BENCHMARK_STRATEGY) para começar imediatamente.
4. **Aprovar F0 (auditoria)** apenas **após** Leva 2; F0 produzirá:
   - `MASTER_INDEX.md` consolidando docs.
   - `DOC_VS_CODE_DIVERGENCE.md` consumindo todas as inconsistências aqui listadas + as descobertas em F0.
   - `RBAC_COVERAGE_MATRIX.md` (ver §5.7) para zerar dúvida em IDOR/admin gating.
5. **Não anunciar** publicamente quaisquer features `planned`/`partial` (ver §FORBIDDEN_ORDERINGS — Leva 2) até F0 fechar matriz de prontidão.
6. **Estabelecer cadência operacional** §6 do `EXECUTION_GOVERNANCE.md` no próximo sprint, mesmo sem instrumentação completa (planilhas servem por enquanto).
7. **Instituir `INCIDENT_LOG.md` + `POSTMORTEM_TEMPLATE.md`** em F1 para que rollback gere registro auditável desde o início.

---

## 13. Apêndice — Estrutura final de `docs/governance/` após esta Leva

```
docs/governance/
├── EXECUTION_GOVERNANCE.md       (Leva 1) ✓
├── PRIORITY_MATRIX.md            (Leva 1) ✓
├── OWNER_MATRIX.md               (Leva 1) ✓
├── RELEASE_GATES.md              (Leva 1) ✓
├── DEFINITION_OF_DONE.md         (Leva 1) ✓
├── STOP_CONDITIONS.md            (Leva 1) ✓
├── ROLLBACK_POLICY.md            (Leva 1) ✓
├── EXECUTION_REPORT_F-1_LEVA_1.md (Leva 1) ✓ ← este relatório
│
├── PRODUCT_SURVIVAL_MODE.md      (Leva 2) — pendente
├── QUALITY_THRESHOLDS.md         (Leva 2) — pendente
├── TRUTH_HIERARCHY.md            (Leva 2) — pendente
├── FORBIDDEN_ORDERINGS.md        (Leva 2) — pendente
├── EXECUTION_BUDGETS.md          (Leva 2) — pendente
├── ARCHITECTURE_STABILITY_POLICY.md (Leva 2) — pendente
└── BENCHMARK_STRATEGY.md         (Leva 2) — pendente
```

> **Nada além de F-1 Leva 1 foi executado.** Iniciar Leva 2 **ou** F0 exige checkpoint explícito do PO + CTO conforme orientação do usuário.

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md)
- [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md)
- [`OWNER_MATRIX.md`](OWNER_MATRIX.md)
- [`RELEASE_GATES.md`](RELEASE_GATES.md)
- [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md)
- [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md)
- [`ROLLBACK_POLICY.md`](ROLLBACK_POLICY.md)
- Plano mestre v3.2: `/home/thales/.cursor/plans/lex_master_documentation_plan_9a6a48df.plan.md`
