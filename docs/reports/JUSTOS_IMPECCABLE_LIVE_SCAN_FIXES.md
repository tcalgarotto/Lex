# JustOS — Fixes pós scan Impeccable (live)

**Data:** 2026-05-25 (atualizado — scan ~20 → alvo &lt;10)

## Alterações

| Achado scan | Ação |
|-------------|------|
| Line length longa (microcopy) | `max-w-[42rem]` alinhado ao lead; bloco hero `max-w-2xl` |
| Low contrast eyebrow | Kicker neutro `.landing-hero-kicker` (sem chip roxo / AI palette) |
| Low contrast body (tema escuro) | Tokens em `[data-theme="dark"]` + cores mais claras |
| Low contrast no gradiente | Poço opaco no hero; `lex-hero-gradient` só `surface-base` |
| `transition: height` (topo) | `SonnerToaster` remove `height` do CSS injetado |
| **Nested cards** (form beta) | Form sem `landing-premium-card`; seção `#beta` sem faixa card |
| **AI color palette** (logo) | `JustOSLogo markTone="neutral"` no header/footer |
| Trust strip pills aninhados | Texto único com separador `·` |
| Tabs do mockup | Aba ativa com `border-b` (sem chip roxo) |
| Nested cards / side-tab (mockup) | Assistente sem border-l; status em `divide-y` |
| Low contrast body | `--marketing-text-secondary` / `--marketing-text-muted` no poço marketing |
| Proof points largos | `max-w-md` na lista |
| `transition: height` (2ª linha header) | Nav in-page em **overlay** (`position: absolute`); sem `display:none` que altera altura do header |
| Blob cortado | Mantido `overflow-x-clip` + glow com inset ampliado |

## Verificação

```bash
npm run impeccable:detect
npm run typecheck
npx playwright test tests/e2e/marketing-audit-14.spec.ts --project=chromium
```

Re-scan manual: Impeccable “Scan page” em `http://localhost:3000/` após hard refresh.
