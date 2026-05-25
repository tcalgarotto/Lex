---
target: homepage JustOS — src/app/(marketing)/page.tsx
total_score: 34
p0_count: 0
p1_count: 0
p2_count: 2
timestamp: 2026-05-25T20:00:00Z
slug: src-app-marketing-page-tsx
phase: pós Fase 2 distill + Fase 3 quieter + rebrand
---

## Design Health Score

| # | Heuristic | Antes | Agora | Key Issue |
|---|-----------|-------|-------|-----------|
| 1 | Visibility of System Status | 3 | 3 | Beta na 2ª dobra; form com loading ok; sem progress de scroll |
| 2 | Match System / Real World | 2 | 4 | JustOS consistente (marca, copy, login, metadata) |
| 3 | User Control and Freedom | 3 | 4 | Nav Preços/Acesso/Pilares; menu mobile; CTA fixo mobile |
| 4 | Consistency and Standards | 2 | 4 | Shell marketing + app alinhados; cards com gramática única por seção |
| 5 | Error Prevention | 3 | 3 | Beta form honeypot + consent |
| 6 | Recognition Rather Than Recall | 2 | 4 | Home enxuta; 11 features em `/produto` |
| 7 | Flexibility and Efficiency | 2 | 4 | `/pricing` no header; beta antecipado |
| 8 | Aesthetic and Minimalist Design | 1 | 3 | Quieter (sem mesh marketing, cards sólidos); ainda denso em `/produto` |
| 9 | Error Recovery | 3 | 3 | Toasts no beta |
| 10 | Help and Documentation | 2 | 2 | Sem FAQ; disclaimer no footer |
| **Total** | | **23/40** | **34/40** | **Meta operacional atingida** |

## Anti-Patterns Verdict

**LLM assessment:** Não (parcial residual em `/produto`). Home deixou template hero-metric, glass default e grid 11× na dobra. `/produto` mantém bento de features (aceitável como página long-form).

**Deterministic scan:** `detect.mjs` ainda quebrado (`bundled detector not found`).

**Visual:** Fase 3 remove mesh, reduz glow, `lex-glass-card` → `surface-card` no app shell.

## What's Working

1. **Distill** — Hero → pilares → beta → problema/solução resumidos → 3 recursos → workflow 3 → segurança 3.
2. **JustOS** — Marca pública coerente com PRODUCT.md / DESIGN.md (Restrained, light default).
3. **Quieter** — Superfícies sólidas, glow atenuado, login sem gradiente violeta pesado.
4. **Mobile** — CTA thumb zone, menu `<details>`, wells responsivos validados em Playwright.

## Priority Issues (remanescentes)

**[P2] `/produto` ainda é bento 11 tiles**
- **Fix:** Fase 4 `layout` — jornadas horizontais.
- **Command:** `impeccable layout`

**[P2] Checkbox consent `readonly` (a11y)**
- **Fix:** Fase 5 `audit`.
- **Command:** `impeccable audit`

## Persona Notes

**Jordan:** Home ≤4 decisões por bloco; recursos completos sob demanda em `/produto`.

**Casey:** CTA fixo + menu nativo; beta mais cedo no scroll.

**Sam:** Verificar contraste AA no light mode pós-quieter.

## E2E (2026-05-25)

| Suite | Resultado |
|-------|-----------|
| `responsive` (público) | 6/6 |
| `02-landing` | 5/5 |
| `auth.setup` + `responsive-justos-auth` | 7/7 (sessão via cookie Supabase) |

## Commands run

```bash
npx playwright test tests/e2e/auth.setup.ts --project=setup
npx playwright test tests/e2e/responsive-justos-auth.spec.ts
npx playwright test tests/e2e/responsive-justos.spec.ts --project=responsive
npx playwright test tests/e2e/02-landing.spec.ts --project=chromium
```
