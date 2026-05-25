# JustOS — Fase 6 final (pendências fechadas)

**Data:** 2026-05-25  
**Score Impeccable home:** **40/40** — `.impeccable/critique/2026-05-25T17-40-00Z__src-app-marketing-page-tsx.md`

---

## Concluído nesta rodada

| Item | Resultado |
|------|-----------|
| `detect.mjs` | `npm run impeccable:detect` → `[]` via `node_modules/impeccable` + `scripts/impeccable-detect-marketing.mjs` |
| Lighthouse mobile | Perf **85**, A11y **89**, BP **96** — LCP **2.2s**, CLS **0** → `docs/reports/lighthouse-home-mobile.json` |
| Prova social honesta | Seção `#compromissos` (`LandingCommitment`) — princípios, sem depoimentos inventados |
| Pixel polish | Sem `backdrop-blur` marketing; ritmo `LANDING_SECTION_PAD`; mock sem métricas 8/14/6 |
| `/produto` | Beta + `LandingMobileCta`; footer `/#beta` `/#seguranca`; padding unificado |
| OG + manifesto | Marca JustOS; copy deploy-ready |
| `prefers-reduced-motion` | Scroll bar, intent arrow, FAQ +, hero proof |
| Live scan Impeccable (~64) | Contraste marketing, eyebrow sentence case, proof `max-w`, header 2ª linha em overlay (sem `height`) → `docs/reports/JUSTOS_IMPECCABLE_LIVE_SCAN_FIXES.md` |

---

## Comandos

```bash
cd /home/thales/Projetos/Lex
npm run impeccable:detect
npm run lighthouse:marketing   # requer dev em :3000
npm run typecheck
npx playwright test tests/e2e/02-landing.spec.ts tests/e2e/marketing-audit-14.spec.ts --project=chromium
npx playwright test tests/e2e/responsive-justos.spec.ts --project=responsive
```

---

## Pendente pós-deploy real

- [ ] Lighthouse em `next start` (build produção)
- [ ] Depoimentos/logos reais → trocar ou complementar `#compromissos`
- [ ] Renomear `LexThemeToggle` (código interno; UI já JustOS)

---

## Arquivos novos/alterados

- `src/components/marketing/landing-commitment.tsx`
- `scripts/impeccable-detect-marketing.mjs`
- `src/lib/marketing/landing-copy.ts` (`LANDING_SECTION_PAD`, `LANDING_COMMITMENTS`)
- `package.json` (`impeccable:detect`, `lighthouse:marketing`, dep `impeccable`, `lighthouse`)
