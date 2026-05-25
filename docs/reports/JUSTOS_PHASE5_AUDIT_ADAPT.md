# JustOS — Fase 5: Audit, adapt, harden

**Data:** 2026-05-25  
**Plano:** `docs/reports/JUSTOS_LANDING_IMPECCABLE_MASTER_PLAN.md` §10  
**Skills:** `impeccable audit` → `harden` → `adapt`

---

## Objetivo

Fechar gaps de heurísticas remanescentes pós-Fase 4:

| Gap | Skill | Status |
|-----|-------|--------|
| #1 Status scroll longo | `craft` progress + section nav | ✅ |
| #10 Help/FAQ | `craft` FAQ 5 perguntas | ✅ |
| Sam a11y checkbox | `audit` | ✅ |
| Casey mobile | `adapt` (já Fase 1b/2; revalidado) | ✅ |
| Riley form intent | `harden` beta CTA | ✅ |
| Dashboard 14" | `adapt` | ✅ |
| Prova social fake | `delight` | ⬜ pendente (sem depoimento real) |

---

## 1. Status de scroll (#1)

### `LandingScrollProgress`

- Barra `role="progressbar"` no topo da viewport.
- Escala horizontal conforme `scrollY / scrollHeight`.

### `LandingSectionNav`

- Sticky abaixo do header (`md+`).
- `IntersectionObserver` marca seção ativa (`aria-current`).
- Âncoras: `LANDING_HOME_SECTIONS` em `landing-copy.ts`.

### CSS

- `scroll-margin-top: 7.25rem` em `main [id]` (desktop) para compensar header + mini-nav.

**Arquivos:** `landing-scroll-progress.tsx`, `landing-section-nav.tsx`, `globals.css`, `page.tsx`.

---

## 2. FAQ (#10)

### `LandingFaq`

- 5 perguntas em `LANDING_FAQ` (`landing-copy.ts`).
- `<details>` / `<summary>` nativos (sem Radix checkbox `readonly`).
- Seção `#faq` no final da home.

**Arquivos:** `landing-faq.tsx`, `landing-copy.ts`, `page.tsx`.

---

## 3. Audit — consentimento beta (Sam)

### Problema (critique)

Snapshot Playwright reportava checkbox com `readonly` (falso positivo ou label não associado).

### Correções

| Item | Antes | Depois |
|------|-------|--------|
| `id` / `htmlFor` | label wrapper sem id | `#beta-consent` + `Label htmlFor` |
| `aria` | só `required` | `aria-required`, `aria-describedby` |
| Hint | — | `#beta-consent-hint` |
| Superfície form | `lex-glass` | `surface-card` sólido |

**Arquivo:** `landing-beta-cta.tsx`

---

## 4. Harden — intent beta vs demo (Riley)

### Problema

Dois botões `submit` com `onClick` que setava `intent` em state — race possível.

### Correção

- `data-intent="beta" | "demo"` no botão.
- `SubmitEvent.submitter` define intent no `submit`.
- `submittingIntent` controla spinner por botão.
- Analytics `landing_demo_click` no submit quando intent demo.

---

## 5. Adapt — dashboard 14"

### Problema

Grid 3 colunas de pulse cards em `xl` (1280px) apertava em 1366px com sidebar.

### Correção

| Mudança | Detalhe |
|---------|---------|
| `.dashboard-pulse-cards` | 2 colunas até 1366px; 3 colunas ≥1367px |
| `.dashboard-briefing-layout` | Rail `var(--dashboard-rail-width)` 17.5rem ≤1366px, 20rem acima |
| `morning-briefing.tsx` | Classes CSS em vez de `xl:grid-cols-3` fixo |

**Arquivos:** `globals.css`, `morning-briefing.tsx`

---

## 6. Testes executados

```bash
cd /home/thales/Projetos/Lex
npm run typecheck
export E2E_BASE_URL=http://127.0.0.1:3000
npx playwright test tests/e2e/02-landing.spec.ts --project=chromium
npx playwright test tests/e2e/responsive-justos.spec.ts --project=responsive
# Com .env.local carregado:
npx playwright test tests/e2e/responsive-justos-auth.spec.ts
```

**Novos asserts:**

- `FAQ e consentimento acessíveis` — `#faq`, `#beta-consent` enabled, sem `readonly`
- Laptop 14" auth — `.dashboard-pulse-cards` width > 600px (se existir)

**Resultado 2026-05-25:** `typecheck` ✅ · `02-landing` 6/6 ✅

---

## 7. Scores esperados (re-critique)

| Superfície | Fase 4 | Fase 5 (est.) |
|------------|--------|----------------|
| Home marketing | 34/40 | **36/40** (#1, #10 ↑) |
| Dashboard | 31/40 | **32/40** |

Arquivo: atualizar `.impeccable/critique/` após validação visual.

---

## 8. Pendente (Fase 6)

- Prova social real (`delight`) — não inventar depoimentos
- `detect.mjs` bundle
- Lighthouse mobile
- `impeccable polish` pass final

---

## Checklist de arquivos

- [x] `src/lib/marketing/landing-copy.ts` — `LANDING_HOME_SECTIONS`, `LANDING_FAQ`
- [x] `src/components/marketing/landing-scroll-progress.tsx`
- [x] `src/components/marketing/landing-section-nav.tsx`
- [x] `src/components/marketing/landing-faq.tsx`
- [x] `src/components/marketing/landing-beta-cta.tsx`
- [x] `src/app/(marketing)/page.tsx`
- [x] `src/components/dashboard/morning-briefing.tsx`
- [x] `src/app/globals.css`
- [x] `tests/e2e/02-landing.spec.ts`
- [x] `tests/e2e/responsive-justos-auth.spec.ts`
- [x] `docs/reports/JUSTOS_PHASE5_AUDIT_ADAPT.md`
