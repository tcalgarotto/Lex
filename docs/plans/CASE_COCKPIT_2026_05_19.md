# Case Cockpit — fluxo do caso jurídico (2026-05-19)

**Frente anterior (segurança / release monitoring):** congelada até P0/P1 em cron/report.

**Problema central:** confusão entre **caso** (matéria do cliente) e **processo judicial** (CNJ/tribunal/vara). Caso pode existir sem processo.

---

## 1. Mapa atual (rotas + arquivos)

| Seção alvo | Rota atual | Página | Componente principal | API / lib |
|------------|------------|--------|----------------------|-----------|
| Novo caso | `/cases/new` | `src/app/(app)/cases/new/page.tsx` | `fundamental-intake-form.tsx` | `POST /api/cases/fundamental-intake` |
| Visão geral | `/cases/[id]` | `cases/[id]/page.tsx` | `case-overview-tab.tsx` | `loadCaseForWorkspace` |
| Entrevista | `/cases/[id]/entrevista` | `entrevista/page.tsx` | `FundamentalIntakeFormContent` (embedded) ou `CaseChecklistTab` | intake + `GET/POST …/checklist` |
| Partes e fatos | `/cases/[id]/partes-fatos` | `partes-fatos/page.tsx` | `case-facts-parties-tab.tsx` | `…/facts`, `parties`, `requests`, `risks` |
| Documentos | `/cases/[id]/documentos` | `documentos/page.tsx` | `case-documents-tab.tsx` | `…/documents`, `DELETE /api/documents/[id]` |
| Pesquisa | `/cases/[id]/pesquisa-juridica` | `pesquisa-juridica/page.tsx` | `research/case-research-tab.tsx` | `recommend-for-case`, `pin`, `LegalSearchPanel` |
| Estratégia + peças | `/cases/[id]/estrategia` | `estrategia/page.tsx` | `estrategia-lazy` → `case-strategy-pieces-tab.tsx` | `POST …/strategy`, `…/draft` |
| Processo | *(parcial na visão geral)* | bloco em `page.tsx` | — | `LegalProcess` + `/processos?returnCase=` |
| Layout cockpit | — | `cases/[id]/layout.tsx` | `CaseCockpitHeader`, `CaseSubnav`, `CaseCopilotPanel` | `case-cockpit-primary-action.ts`, `case-legal-workflow.ts` |
| Compat `?tab=` | — | — | `case-legacy-query-redirect.tsx` | redireciona para rotas por seção |

**Já entregue (não refazer):** P0.2 lazy intake (salvar sem IA, organizar opcional), entrevista fundamental embutida, subnav por rotas, pesquisa embutida no caso, estratégia embutida (lab `/strategy` só link avançado), delete de documento com confirmação.

**Gaps vs objetivos:**

| # | Gap | Severidade |
|---|-----|------------|
| G1 | Processo judicial misturado na visão geral; sem aba dedicada | P0 UX |
| G2 | CNJ/tribunal visíveis mesmo em “pré-processual” na entrevista | P0 UX |
| G3 | Links secundários ainda saem do caso (`/pesquisa-juridica`, `/processos`) | P1 |
| G4 | Uma aba só para “Estratégia e peças” (pedido: separar ou renomear) | P2 |
| G5 | Entrevista guiada por tópicos (urgência, objetivo, “há processo?”) — parcial no form longo | P2 |
| G6 | IA deve estruturar relato (não copiar) — prompt em `deepseek-structure.ts`; validar copy UI | P2 |
| G7 | Botão excluir documento só ícone — falta rótulo visível | P2 |

---

## 2. Plano em fases (curto)

### Fase 1 — Cockpit e caso ≠ processo *(esta rodada)*

- [x] Aba **Processo vinculado** (`/cases/[id]/processo`) + componente `CaseProcessTab`
- [x] Visão geral sem bloco CNJ (link para aba processo)
- [x] CNJ/tribunal/vara na entrevista **somente** se fase = processo existente
- [x] Links de pesquisa recomendada e menu “Vincular processo” apontam para rotas do caso
- [x] Testes subnav + gates lint/typecheck/test

### Fase 2 — Tabs e CTAs *(2026-05-19)*

- [x] Subnav: “Fatos e partes”, “Estratégia”, “Peças e minutas”, “Processo vinculado”
- [x] Rota `/cases/[id]/pecas` + `CasePiecesTab`
- [x] CTAs overview, copiloto, pesquisa, dashboard → rotas do caso
- [x] `case-cockpit-routes.ts` + testes `case-flow` / `case-cockpit-next-actions`
- [x] Botão Excluir documento com rótulo visível + `title`/`aria-label`

### Fase 3 — Entrevista guiada + IA *(2026-05-19)*

- [x] Stepper guiado (9 etapas) + card Caso ≠ processo + revisão com checklist complementar
- [x] CNJ/tribunal só em `existing_process`; pré-processual OK sem CNJ
- [x] Prompt/schema IA: lacunas, relações, provas, `needs_confirmation`, anti-cópia de relato
- [x] Aba Fatos e partes: `CaseIntakeDerivedSections`, insuficiência, perguntas pendentes
- [x] Testes `case-cockpit-phase3-intake.test.ts` + gates lint/typecheck/test focados

### Fase 3.2 — Polimento UX visual da entrevista *(2026-05-19, em andamento)*

- [x] Sidebar compacta (`IntakeCompactSidebar`): progresso, próxima pergunta, ≤3 lacunas, nav/checklist colapsáveis
- [x] Layout grid (sem `fixed` / sem sobreposição)
- [x] `LegalSectionCard` com `tone` (essential/optional)
- [x] Progressive disclosure: Atendimento, Cliente, Contrária, Relato, Gestão
- [x] Gestão do atendimento não pesa no progresso (`communication: complete`)
- [x] Testes `case-cockpit-phase32-intake-ux.test.ts`
- [ ] Review visual manual 1920 / 1366 (pendente operador)

Comandos (2026-05-19, Fase 3.2):

```bash
npm run typecheck   # OK
npm run lint        # OK (4 warnings pré-existentes)
npm test -- tests/cases/case-cockpit-phase32-intake-ux.test.ts \
  tests/cases/case-cockpit-phase31-intake-refinement.test.ts \
  tests/cases/case-cockpit-phase3-intake.test.ts \
  tests/cases/fundamental-intake.test.ts \
  tests/ui/case-flow.test.ts
# 73 testes OK
```

### Fase 4 — QA

- E2E autenticado: novo caso pré-processual sem CNJ → cockpit → entrevista → documentos
- Atualizar `docs/UX_FLOW_AUDIT.md` e `COMMERCIAL_UX_P0_AUDIT.md`

---

## 3. Registro de execução

### Fase 1 (2026-05-19)

| Item | Status |
|------|--------|
| Plano + mapa | ✅ |
| Aba processo | ✅ |
| CNJ condicional | ✅ |
| Links in-case (parcial) | ✅ |

### Fase 2 (2026-05-19)

| Item | Status |
|------|--------|
| Split Estratégia / Peças | ✅ |
| CTAs dashboard + overview | ✅ |
| Excluir documento UX | ✅ |
| Testes | ✅ ver comandos abaixo |
| `npm run lint` | ✅ (warnings pré-existentes + Link removido) |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 12 testes (`case-flow` + `case-cockpit-next-actions`) |

### Fase 3 (2026-05-19)

| Item | Status |
|------|--------|
| `intake-guided-flow.ts` + `IntakeGuidedStepper` | ✅ |
| Checklist complementar MVP | ✅ |
| IA: schema + `deepseek-structure` + `structure-quality` | ✅ |
| Display: `case-intake-context` + `case-intake-derived-sections` | ✅ |
| `npm run lint` | ✅ (warnings pré-existentes) |
| `npm run typecheck` | ✅ |
| `npm test` (focados intake/cockpit) | ✅ ver abaixo |

Comandos (2026-05-19):

```bash
npm run lint
npm run typecheck
npm test -- tests/cases/case-cockpit-phase3-intake.test.ts tests/cases/fundamental-intake.test.ts \
  tests/cases/lazy-intake-save.test.ts tests/cases/lazy-intake-p02-closure.test.ts \
  tests/cases/lazy-intake-phase4.test.ts tests/cases/build-case-task-context.test.ts \
  tests/ui/case-flow.test.ts tests/ui/case-cockpit-next-actions.test.ts
```
