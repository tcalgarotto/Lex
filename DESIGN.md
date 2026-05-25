# Design — JustOS

> Gerado na Fase 0 (teach + document). Alinha ao DS existente (`globals.css`, `docs/DESIGN_SYSTEM.md`) com direção **Restrained** e **light default**.

## Visual theme

**Cena:** advogado no escritório, luz natural de manhã, monitor com caso aberto e pilha digital organizada — não sala escura de “devtools”.

| Modo | Uso |
|------|-----|
| **Light** | Default (primeira visita e sem preferência salva) |
| **Dark** | Toggle explícito; mesma hierarquia, menos glow |

## Color strategy

**Restrained** — neutros tintados (hue violeta ~280, chroma 0.005–0.01 nos neutros) + accent violeta só em CTA, foco e marca. Sem `#000` / `#fff` puros; sem drenched violet no fundo.

### Tokens (referência — implementação em `globals.css`)

| Role | Light | Dark |
|------|-------|------|
| `--surface-base` | `#f8fafc` (tinted) | `#09090b` (tinted) |
| `--surface-card` | `#ffffff` | `#101010` |
| `--brand-primary` | `oklch(0.52 0.19 292)` ≈ `#6d28d9` | `oklch(0.58 0.22 292)` |
| Accent share | ≤10% área visível típica | idem |

**Marketing:** `--hero-violet-glow` e blur reduzidos (Fase 3 ✅); mesh desligado na landing; preferir `surface-card` sólido.

## Typography

| Uso | Família | Notas |
|-----|---------|--------|
| UI + corpo | `--font-sans` (Atkinson Hyperlegible, Inter) | Legibilidade jurídica |
| Display marketing H1 | `--font-serif` (DM Serif Display) | Uma vez por viewport; não em cards |
| Card titles | sans semibold | Sem serif em grids |

Escala: hierarquia por peso + tamanho (ratio ≥1.25 entre steps). Corpo máx. 65–75ch.

## Components (marketing)

| Componente | Direção |
|------------|---------|
| `JustOSLogo` | Mark + wordmark; sem caixa violeta pesada |
| Header sticky | Sólido light; blur **somente** após scroll (opcional, leve) |
| Cards | Borda sutil, fundo `surface-card`; sem hover glow forte |
| CTA primário | `brand-primary` sólido; sombra discreta |
| Hero mockup | Mantém credibilidade de produto; `aria-hidden` |

## Layout

- Gutter: `--lex-page-gap` / `.lex-marketing-well` (70vw poço)
- Evitar nested cards; máx. 4 itens por grupo de decisão na home (pós-distill)
- Espaçamento com ritmo (não padding uniforme em tudo)

## Motion

- `prefers-reduced-motion`: desligar float/pulse/shimmer
- Easing: ease-out-quart/quint; sem bounce
- Não animar propriedades de layout

## Logo

- **Mark:** `JustOSLogoMark` — coluna + balança em traço contínuo (evolução da marca jurídica Lex, geometria mais compacta)
- **Lockup:** `JustOSLogo` — mark 36px + “JustOS” sans semibold
- Cor: `currentColor` / `var(--brand-primary)` no mark; texto `var(--text-primary)`

## Absolute bans (Impeccable)

Sem: side-stripe borders, gradient text, glass default, hero-metric template, card grids idênticos 11×, modal como primeira solução.

## Files

- Tokens: `src/app/globals.css`
- Logo: `src/components/brand/justos-logo-mark.tsx`, `justos-logo.tsx`
- Nome canônico UI: `src/lib/brand/justos.ts`
