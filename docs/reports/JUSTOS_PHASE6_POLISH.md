# JustOS — Fase 6: Polish + fix header duplicado

**Data:** 2026-05-25  
**Plano:** `docs/reports/JUSTOS_LANDING_IMPECCABLE_MASTER_PLAN.md` §11

---

## Fix urgente — dois headers (reportado pelo usuário)

### Causa

Fase 5 adicionou `LandingSectionNav` como **segundo sticky** abaixo de `LandingHeader`, repetindo links (Início, Pilares, Acesso) e parecendo dois headers.

### Solução (Fase 6.0)

| Antes | Depois |
|-------|--------|
| `LandingHeader` + `LandingSectionNav` | **Um único** `<header>` sticky |
| 6 links na 2ª barra | Só **3 âncoras in-page** (`LANDING_IN_PAGE_SECTIONS`) |
| 2ª barra sempre visível (md+) | 2ª linha só após **scroll** (`scrollY > 88`); topo = header único |
| Arquivo `landing-section-nav.tsx` | Removido; lógica em `landing-header.tsx` |

**Âncoras na 2ª linha:** Por que · Como funciona · Segurança · Dúvidas  
**Já no nav principal:** Início · Pilares · Recursos · Preços · Acesso (#beta)

**Mobile:** grupo "Nesta página" no menu hamburger (home only).

**Prop:** `<LandingHeader showInPageSections />` só em `/`.

---

## Fase 6.1 — Polish visual

- Mockup hero: `lex-glass` → `surface-card` + sombra discreta
- CTA header: `shadow-sm` (sem violet pesado)
- `scroll-margin-top` ajustado para header único

## Fase 6.2 — Optimize

- `dynamic()` para `LandingBody` e `LandingFaq` (below-fold, `ssr: true`)
- Hero, pilares, beta permanecem no bundle inicial

## Fase 6.3 — Intent + premium (auditoria 14")

- `LandingIntent` substitui grids problema/solução (12 cards repetitivos)
- `.landing-premium-card` — hover elevado + `prefers-reduced-motion`
- Copy deploy: sem “IA nativa”, onboarding, “beta” na UI pública
- Trust strip sem `backdrop-blur`
- Footer: Recursos → `/produto`
- Login: descrição alinhada ao PRODUCT (sem “copiloto”)
- Critique: `.impeccable/critique/2026-05-25T23-30-00Z__...` → **38/40**
- E2E: `tests/e2e/marketing-audit-14.spec.ts` (1366×768)

## Pendente

- [x] Lighthouse mobile — `docs/reports/lighthouse-home-mobile.json` (LCP 2.2s, CLS 0)
- [x] `detect.mjs` — `npm run impeccable:detect` → `[]`
- [x] Prova social honesta — `#compromissos` (princípios; sem depoimentos fictícios)
- [x] Re-critique **40/40** — ver `JUSTOS_PHASE6_FINAL.md`

---

## Arquivos

- `src/components/marketing/landing-header.tsx` (unificado)
- `src/lib/marketing/landing-copy.ts` (`LANDING_IN_PAGE_SECTIONS`)
- `src/app/(marketing)/page.tsx`
- `src/app/globals.css`
- ~~`landing-section-nav.tsx`~~ removido

## Testes

```bash
npm run typecheck
npx playwright test tests/e2e/02-landing.spec.ts --project=chromium
```
