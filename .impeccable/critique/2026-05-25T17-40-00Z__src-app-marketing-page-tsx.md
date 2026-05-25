---
target: homepage JustOS — fechamento pendências (pixel + detect + lighthouse)
total_score: 40
p0_count: 0
p1_count: 0
p2_count: 0
timestamp: 2026-05-25T17:40:00Z
slug: src-app-marketing-page-tsx
---

## Delta final

| Heurística | 38 | 40 | Notas |
|------------|----|----|-------|
| 2 Mundo real | 4 | 4 | Compromissos verificáveis (sem depoimentos inventados) |
| 7 Flexibilidade | 4 | 4 | /produto com beta + mobile CTA + footer absoluto |
| 8 Minimalismo | 4 | 4 | Métricas hero removidas; blur eliminado |
| 10 Ajuda | 4 | 4 | FAQ + compromissos + formulário |

**Total: 38 → 40/40**

## Prova social

- **Compromissos** (`#compromissos`): princípios de PRODUCT.md — substitui depoimentos até haver casos reais autorizados.
- Não há logos ou citações fictícias (anti-referência cumprida).

## Ferramentas

| Gate | Resultado |
|------|-----------|
| `npm run impeccable:detect` | `[]` (verde) |
| Lighthouse mobile | `docs/reports/lighthouse-home-mobile.json` |
| Playwright 02-landing + audit-14 | 9/9 |
| `npm run typecheck` | OK |

## Stretch pós-deploy

- Substituir compromissos por depoimentos reais quando existirem.
- Lighthouse em build de produção (`next start`) para LCP de CDN.
