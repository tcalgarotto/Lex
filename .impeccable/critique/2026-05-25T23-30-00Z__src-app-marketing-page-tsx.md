---
target: homepage JustOS — pós Fase 6 polish (intent, premium cards, copy deploy)
total_score: 38
p0_count: 0
p1_count: 0
p2_count: 1
timestamp: 2026-05-25T23:30:00Z
slug: src-app-marketing-page-tsx
---

## Delta Fase 6 (polish final)

| Heurística | Antes (F5) | Agora | Notas |
|------------|------------|-------|-------|
| 1 Visibilidade do status | 4 | 4 | Progress + nav in-page pós-scroll |
| 2 Correspondência mundo real | 4 | 4 | Tom advogado; sem “IA nativa”, onboarding, beta na UI |
| 3 Controle e liberdade | 4 | 4 | Nav + footer `/produto`; FAQ |
| 4 Consistência | 4 | 4 | Header único; tokens surface-card |
| 5 Prevenção de erros | 4 | 4 | Form consent + intent |
| 6 Reconhecimento | 4 | 4 | Pilares + intent dor→ganho |
| 7 Flexibilidade | 3 | 4 | Teaser 3 + link /produto |
| 8 Estética minimalista | 3 | 4 | Problema/solução 12 cards removidos; mesh off |
| 9 Recuperação de erros | 4 | 4 | Toast form |
| 10 Ajuda | 4 | 4 | FAQ deploy-ready |

**Total: 36 → 38/40**

## P2 remanescente (não inventar)

- Prova social verificável (depoimentos, logos de escritórios reais)

## Anti-patterns

- AI slop: **Não** — copy específica ao fluxo jurídico
- Glass overload: **Não** — trust strip sólido; cards premium com sombra leve
- Header duplicado: **Corrigido**

## Testes

```bash
npx playwright test tests/e2e/marketing-audit-14.spec.ts --project=chromium
npx playwright test tests/e2e/02-landing.spec.ts tests/e2e/responsive-justos.spec.ts --project=chromium
```

Stretch 40/40: prova social real + Lighthouse LCP verde.
