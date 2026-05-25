# JustOS — Fase 4: Layout por jornada (`/produto`)

**Data:** 2026-05-25  
**Plano mestre:** `docs/reports/JUSTOS_LANDING_IMPECCABLE_MASTER_PLAN.md` §9  
**Skill Impeccable:** `layout` + `craft`  
**Issue P2 resolvida:** grid bento 11× cards idênticos na página de recursos

---

## Objetivo

Substituir o padrão anti-pattern **11 tiles** (ícone + título + descrição + Ex.) por **3 histórias horizontais** alinhadas ao fluxo real do escritório:

1. **Captação** — contato → caso aberto  
2. **Caso** — documentos, pesquisa, prazos  
3. **Peça** — minuta conectada com revisão profissional  

---

## O que foi feito

### 1. Copy e dados (`src/lib/marketing/landing-copy.ts`)

| Export | Função |
|--------|--------|
| `LANDING_PRODUCT_JOURNEYS` | 3 jornadas com `featureIds`, narrativa e `snippet` (UI decorativa) |
| `landingFeaturesByIds()` | Resolve features a partir dos IDs da jornada |

**Mapeamento de features por jornada:**

| Jornada | Feature IDs |
|---------|-------------|
| Captação | `site`, `email`, `casos`, `native-ai` |
| Caso | `documentos`, `pesquisa`, `acervo`, `agenda`, `integracoes`, `biblioteca` |
| Peça | `pecas`, `pesquisa`, `native-ai`, `livros`, `biblioteca` |

Todas as 12 entradas de `LANDING_FEATURES` aparecem em pelo menos uma jornada ou no índice.

### 2. Componentes novos

| Arquivo | Responsabilidade |
|---------|------------------|
| `landing-journey-panel.tsx` | Snippet estático de produto (`aria-hidden`) |
| `landing-product-journeys.tsx` | Layout alternado texto/painel + CTA para `/#beta` |
| `landing-product-capabilities.tsx` | Índice `<dl>` compacto (substitui bento) |

### 3. Refatoração

| Arquivo | Mudança |
|---------|---------|
| `landing-body-produto.tsx` | Remove `landing-bento` + `LandingLiveCard` grid |
| `produto/page.tsx` | H1/metadata alinhados às jornadas |
| `globals.css` | Utilitários `.landing-journey`, `.landing-journey-panel` |

### 4. Removido

- Grid `landing-bento` com `FEATURE_BENTO` spans na página `/produto`
- Dependência de `LandingLiveCard` em `landing-body-produto.tsx` (mantido em outros contextos se necessário)

---

## Layout (comportamento)

- **Desktop:** 2 colunas — narrativa + lista de capacidades da jornada | painel snippet; jornada 2 com ordem invertida (`lg:order`).
- **Mobile:** coluna única — texto acima, painel abaixo.
- **Índice:** lista `<dl>` com título + descrição + exemplo (scan rápido, sem cards repetidos).
- **Seções mantidas:** fluxo 6 passos, público-alvo (cards simples com borda sólida).

---

## Testes

```bash
cd /home/thales/Projetos/Lex
export E2E_BASE_URL=http://127.0.0.1:3000
npx playwright test tests/e2e/02-landing.spec.ts -g "Recursos"
```

**Assertivas adicionadas:**

- H1 `Recursos em três jornadas`
- Texto `Jornada 1 · Captação` visível
- `#jornadas` com scroll (`LandingReveal` só anima in-view)

---

## Comandos executados (registro)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ OK |
| `npx playwright test tests/e2e/02-landing.spec.ts -g Recursos` | ✅ OK (após ajuste seletor jornada) |

---

## Heurísticas Nielsen (expectativa pós-Fase 4)

| # | Antes (critique) | Esperado |
|---|------------------|----------|
| 6 Recognition | 4 (home) / 2 (`/produto` bento) | 4 em `/produto` |
| 8 Minimalist | 3 (home) / 1 (bento) | 4 em `/produto` |
| Anti-pattern grid 11× | P2 aberto | **Resolvido** na rota `/produto` |

**Score marketing global:** manter ≥34/40 na home; `/produto` sobe de ~28 para ~32+ (estimativa).

---

## Pendente (Fase 5+)

- [ ] FAQ / help na landing  
- [ ] `audit` — checkbox consent `readonly`  
- [ ] `adapt` — dashboard denso em 1366px  
- [ ] `detect.mjs` — bundle detector  
- [ ] Re-critique formal `/produto` após validação visual

---

## Arquivos tocados (checklist)

- `src/lib/marketing/landing-copy.ts`
- `src/components/marketing/landing-journey-panel.tsx` (novo)
- `src/components/marketing/landing-product-journeys.tsx` (novo)
- `src/components/marketing/landing-product-capabilities.tsx` (novo)
- `src/components/marketing/landing-body-produto.tsx`
- `src/app/(marketing)/produto/page.tsx`
- `src/app/globals.css`
- `tests/e2e/02-landing.spec.ts`
- `docs/reports/JUSTOS_PHASE4_LAYOUT.md` (este arquivo)
