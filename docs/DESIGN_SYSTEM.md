# Lex — Design System (app)

Design system do produto **Lex**, alinhado à experiência da área de **Casos** (vidro, blur, gradientes de luz neutros, fundo com orbes fixos). Aplica-se a **todo o site** nas rotas da app e marketing, em **dark** e **light**.

---

## 1. Princípios

1. **Superfície em camadas** — fundo base (`body::before`) + orbes opcionais (`.lex-glass-mesh`) + conteúdo acima; cartões e painéis em **vidro** (`backdrop-filter`), não blocos opacos soltos.
2. **Luz neutra no vidro** — brilho nos cards vem de **branco translúcido** (`--glass-sheen`, `--glass-card-sheen`), não de manchas roxas dentro do cartão.
3. **Marca com parcimônia** — violeta para **marca, links ativos e foco**; CTAs secundários preferem **`.lex-glass-card`** em vez de preenchimento sólido roxo.
4. **Um tema, um atributo** — `html[data-theme="light" | "dark"]`; Tailwind `dark:` usa o seletor `[data-theme="dark"]` (ver `tailwind.config.ts`).
5. **Persistência** — preferência de tema em `localStorage` (`lex-theme`: `light` | `dark` | `auto`); script em `src/app/layout.tsx` evita flash.

---

## 2. Tipografia

| Uso | Stack | Onde |
|-----|--------|------|
| UI / corpo | Geist Sans (`--font-geist-sans`) | `body`, componentes |
| Código / atalhos | Geist Mono | `.lex-kbd`, trechos técnicos |
| Títulos de marketing / hero | DM Serif Display (`--font-serif`) | `font-serif`, landing |

Tamanho raiz: **14px** em `html` (ajuste global de densidade).

---

## 3. Raio, movimento e sombras Lex

Definidos em `:root` (`globals.css`):

| Token | Valor (ex.) | Uso |
|-------|----------------|-----|
| `--r-xs` … `--r-3xl`, `--r-full` | 4px → 24px, pill | cantos de chips, cards |
| `--ease` | cubic-bezier(0.16, 1, 0.3, 1) | curva padrão |
| `--t-fast` / `--t-base` / `--t-slow` | 100 / 180 / 320ms | hover, tema |
| `--shadow-xs` … `--shadow-lg`, `--shadow-violet` | — | elevação, CTA marca |

Utilitário **`.lex-transition`** — transição suave em cor, fundo, borda, sombra, transform, opacidade.

---

## 4. Tokens semânticos (dark / light)

Todos vivem em **`src/app/globals.css`** sob `[data-theme="dark"]` e `[data-theme="light"]`. Use **sempre variáveis**, não cores literais em novas telas.

### 4.1 Superfície

| Token | Função |
|--------|--------|
| `--surface-base` | Fundo “página” (alinhado a `--background` HSL) |
| `--surface-sidebar` | Sidebar / áreas laterais |
| `--surface-card` | Preenchimentos opacos legados (inputs densos, etc.) |
| `--surface-elevated` | Áreas um pouco acima do base |
| `--surface-overlay` / `--surface-overlay-strong` | Hover, inputs sobre vidro |

### 4.2 Texto

| Token | Uso |
|--------|-----|
| `--text-primary` | Títulos, corpo principal |
| `--text-secondary` | Subtítulos, descrições |
| `--text-muted` | Metadados, placeholders |
| `--text-disabled` | Inativo |
| `--text-inverse` | Texto sobre marca sólida |

**Padrão em vidro (dark):** `text-[color:var(--text-primary)]` + `dark:text-white` só quando quiser branco puro no escuro (ex.: CTA glass).

### 4.3 Bordas e foco

| Token | Uso |
|--------|-----|
| `--border-subtle` / `--border-default` / `--border-strong` | divisores, inputs |
| `--border-focus` | anel de foco (acessível) |

### 4.4 Marca

| Token | Uso |
|--------|-----|
| `--brand-primary` / `--brand-hover` | ações primárias sólidas (uso raro) |
| `--brand-text` | links / estados ativos na navegação |
| `--brand-border` / `--brand-subtle` | contornos e fundos tintos leves |

### 4.5 Feedback (status)

`--success-*`, `--warning-*`, `--danger-*`, `--info-*` — fundos e bordas de alertas e chips de estado.

### 4.6 Vidro (glassmorphism)

| Token | Função |
|--------|--------|
| `--glass-bg` / `--glass-bg-strong` | camada base semi-transparente atrás do blur |
| `--glass-border` | contorno do painel de vidro |
| `--glass-blur` | ex.: `blur(26px) saturate(185%)` |
| `--glass-shadow` | sombra externa + filete interno (`--glass-edge`) |
| `--glass-sheen` | gradiente diagonal neutro (painéis genéricos) |
| `--glass-card-sheen` | radiais + gradiente **neutro** (cartões) |

---

## 5. Componentes CSS (utilitários)

Definidos em `@layer components` no mesmo ficheiro.

| Classe | Quando usar |
|--------|----------------|
| **`.lex-glass`** | Barras, topbar, painéis médios com vidro |
| **`.lex-glass-strong`** | Vidro um pouco mais opaco |
| **`.lex-glass-card`** | **Cartões** (lista de casos, formulários em caixa, CTAs “Novo caso”), `rounded-2xl` típico |
| **`.lex-glass-mesh`** | Wrapper **fixo** de orbes; já montado no `AppShell` — não duplicar por página salvo exceção (ex.: marketing full-bleed) |
| **`.lex-glass-mesh__blob--a` … `--d`** | Cores por tema; máscara linear no mesh reduz intensidade no fundo do viewport |
| **`.lex-hero-gradient`** | Hero marketing |
| **`.lex-kbd`** | Atalhos (ex. ⌘K) |
| **`.lex-btn-primary`** | Botão sólido marca (legado; preferir vidro para CTAs secundários) |

**Regra:** em cartões de vidro **não** combinar `bg-[color:var(--surface-card)]` opaco por cima de `.lex-glass-card` — anula o efeito.

---

## 6. Camadas de fundo (importante para blur)

1. **`body::before`** — `position: fixed; z-index: -1; background: hsl(var(--background))` — cor base da página.
2. **`.lex-glass-mesh`** — `position: fixed; z-index: 0` — orbes coloridos **atrás** do conteúdo.
3. **Conteúdo** — sidebar, main, modais: stacking normal **acima** do mesh.

O `backdrop-filter` dos elementos com vidro compõe com o que está visualmente atrás (base + orbes).

---

## 7. Padrões de UI (alinhados a `/cases`)

### 7.1 Cabeçalho de página

- Título: `text-[color:var(--text-primary)]`, peso semibold, tracking tight.
- Subtítulo: `text-[color:var(--text-secondary)]`, `leading-relaxed`.
- Ação principal secundária (ex. “Novo caso”): **link** com `.lex-glass-card` + `rounded-2xl` + altura `h-11`, sem ícone “+” se o texto for suficiente.

### 7.2 Listas em grelha / masonry

- Colunas flex com índices pares/ímpares para “masonry” leve, ou grelha com `items-start` se alturas uniformes por linha forem aceitáveis.
- Cartões: **`.lex-glass-card`**, metadados com `text-[color:var(--text-muted)]`.

### 7.3 Formulários inline (busca)

- Caixa: `.lex-glass-card` + `rounded-2xl` + padding.
- Inputs sobre vidro: `bg-[color:var(--surface-overlay-strong)]`, borda `--border-default`.

### 7.4 Estado vazio

- Componente **`EmptyState`** (`src/components/ui/empty-state.tsx`): tokens de texto/borda; CTA opcional com `action: { appearance: "glass", href: "..." }` para o mesmo aspeto dos CTAs em vidro.

### 7.5 Tema (sidebar)

- **`LexSidebarThemeToggle`** — sol / lua / monitor (auto); sem texto “system” visível.

---

## 8. shadcn / Tailwind

- Cores `background`, `foreground`, `primary`, `card`, etc. mapeiam para variáveis HSL em `[data-theme]`.
- Preferir **`text-foreground` / `bg-background`** em layouts genéricos; em superfícies de vidro preferir **tokens Lex** (`--text-*`, `--glass-*`) para consistência com a página de casos.
- **Evitar** paletas Tailwind literais (`zinc-*`, `slate-*`, `border-white/10`) em UI de produto — mapear para `text-[color:var(--text-*)]`, `border-[color:var(--border-*)]`, `bg-[color:var(--surface-*)]`.

### 8.1 Onde o DS está aplicado no código

| Área | Ficheiro |
|------|-----------|
| **Card** (vidro por defeito) | `src/components/ui/card.tsx` — `.lex-glass-card` + `rounded-2xl` |
| **Dialog** | `src/components/ui/dialog.tsx` — `.lex-glass-strong` no conteúdo |
| **Dropdown** | `src/components/ui/dropdown-menu.tsx` — `.lex-glass` + tokens |
| **Tooltip** | `src/components/ui/tooltip.tsx` — `.lex-glass` + tokens |
| **Painéis tracejados / inset** | `globals.css` — `.lex-inset`, `.lex-inset-solid` |
| **Classes partilhadas** | `src/lib/lex-ds.ts` |

---

## 9. Checlista para novas páginas

- [ ] Texto com `--text-primary` / `--text-secondary` / `--text-muted` (não `zinc-*` / `slate-*`).
- [ ] Cartões ou painéis principais com **`.lex-glass`** ou **`.lex-glass-card`** + `rounded-2xl` quando fizer sentido.
- [ ] Sem bloquear o mesh: não usar `bg-background` opaco em wrapper full-screen por cima do conteúdo da app (o `AppShell` já está alinhado).
- [ ] CTAs não marca: **vidro** (`lex-glass-card` ou `EmptyState` `appearance: "glass"`).
- [ ] Foco visível: `focus-visible:ring-2` + `--border-focus` / ring-offset com `--surface-base`.
- [ ] Testar em **dark** e **light** (`data-theme`).

---

## 10. Ficheiros de referência

| Ficheiro | Conteúdo |
|----------|-----------|
| `src/app/globals.css` | Tokens + classes `.lex-*` |
| `src/app/layout.tsx` | Script inicial de tema |
| `src/components/ui/theme-toggle.tsx` | Preferência + `applyThemePreference` |
| `src/components/app/app-shell.tsx` | Mesh + estrutura app |
| `src/app/(app)/cases/page.tsx` | Referência viva: header, busca, cards, empty |
| `src/components/ui/card.tsx` | Cartão shadcn = vidro Lex |
| `src/components/ui/dialog.tsx` | Modal = vidro forte |
| `src/lib/lex-ds.ts` | CTAs e strings de classe partilhadas |
| `tailwind.config.ts` | `darkMode: ['selector', '[data-theme="dark"]']` |

Documento HTML legado (referência visual histórica): `docs/model design/lex-design-system-v2.html` — o **DS canónico do produto** é este ficheiro + `globals.css`.

---

## 11. Evolução

- Novos tokens: acrescentar em **ambos** `[data-theme="dark"]` e `[data-theme="light"]` e documentar aqui.
- Novos padrões de componente: preferir **uma** classe `.lex-*` ou variant em componente React partilhado antes de copiar classes longas.
