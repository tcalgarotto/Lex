# Lex — Tipografia (Design System)

Documento de **escala, papéis semânticos e mapa por secção** da app. Complementa [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (vidro, tokens de cor, componentes). Objetivo: **fontes legíveis e previsíveis** em todo o site, com um vocabulário partilhado entre equipa e código.

---

## 1. Fontes e raiz

| Camada | Valor | Onde |
|--------|--------|------|
| **UI (sans)** | Atkinson Hyperlegible → Inter → sistema | `tailwind.config.ts` → `fontFamily.sans`, `globals.css` `--font-sans` |
| **Mono** | Geist Mono (`--font-geist-mono`) | atalhos, código, IDs |
| **Serif / marketing** | DM Serif Display | `font-serif`, hero landing |

**Tamanho raiz**

- `html { font-size: 16px; }` — `src/app/globals.css`
- `body` usa `font-size: var(--text-base)` (16px) e `line-height: var(--leading-readable)` (1.5).

> Nota: o DS principal em [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) mencionava por vezes 14px na raiz; a implementação atual é **16px**. Este ficheiro reflete o código.

---

## 2. Tokens de tamanho (escala Lex + P1 semânticos)

Definidos em `:root` em `src/app/globals.css` e expostos no Tailwind em `theme.extend.fontSize` (`tailwind.config.ts`).

### 2.0 Tokens semânticos P1 (preferir em código novo)

| Token CSS | Rem / px | Utilitário Tailwind | Papel |
|-----------|----------|---------------------|--------|
| `--text-micro` | 0.6875rem (**11px**) | `text-micro` | Só **curto e decorativo**: uppercase de cartão, tag secundária, kicker muito denso. **Não** parágrafos nem instruções. |
| `--text-caption` | = `--text-xs` (**13px**) | `text-caption` | Metadados importantes, badges densos, hora em lista, mono curto. |
| `--text-section-title` | = `--text-sm` (**14px**) | `text-section` | H2 / título de secção dentro de cartão. |
| `--text-control` | 0.9375rem (**15px**) | `text-control` | Botões default, headline de métrica, CTAs densos. |
| `--text-body` | = `--text-base` (**16px**) | `text-body` | Corpo padrão (alias explícito). |
| `--text-readable` | = `--text-md` (**17px**) | `text-readable` | Títulos em cartões de lista, destaques de leitura. |

**Line-height (referência)**

- `--leading-tight-readable` (1.35) — títulos curtos; usada por `text-micro`, `text-section`, `text-control`, `text-readable` no Tailwind.
- `--leading-readable` (1.5) — corpo; usada por `text-caption` e `text-body`.
- `--leading-relaxed-readable` (1.65) — blocos longos / leads.
- `--lex-lh-micro`, `--lex-lh-snug`, `--lex-lh-ui` — usados pelos utilitários legados `text-lex-*`.

### 2.1 Escala base (compat)

| Token CSS | Rem / px (aprox.) | Utilitário Tailwind |
|-----------|-------------------|---------------------|
| `--text-xs` | 0.8125rem (**13px**) | `text-xs` (= `text-caption`) |
| `--text-sm` | 0.875rem (**14px**) | `text-sm` (= `text-section` em papel de secção) |
| `--text-base` | 1rem (**16px**) | `text-base` (= `text-body`) |
| `--text-md` | 1.0625rem (**17px**) | `text-md` ou `text-readable` |
| `--text-lg` | 1.125rem (**18px**) | `text-lg` |

**Importante:** neste projeto, `text-xs` **não** é 12px — é **13px**. Evitar `text-[12px]`, `text-[11px]`, etc.; usar `text-caption`, `text-sm` ou `text-micro` conforme as regras da secção 3.

### 2.2 Compat: `--lex-type-*` + `text-lex-*`

O bloco `--lex-type-*` em `globals.css` está **mapeado** aos tokens P1 (ex.: `--lex-type-metric-size` → `--text-control`, `--lex-type-badge-size` → `--text-caption`). Alterar `--text-micro` … `--text-readable` ou `--lex-type-*` propaga para utilitários `text-lex-*` e constantes em `src/lib/lex-ds.ts`.

| Utilitário | Aponta para (resumo) | Uso típico |
|------------|----------------------|------------|
| `text-lex-micro` | `--text-micro` | Igual a `text-micro` (rail, kickers). |
| `text-lex-subtle` | `--text-caption` | Tempo, fila. |
| `text-lex-eyebrow` / `text-lex-eyebrow-lg` | micro / caption | Topbar. |
| `text-lex-rail` | `--text-micro` | Mono curto, iniciais. |
| `text-lex-detail` | `--text-sm` | Linhas de apoio em pulso. |
| `text-lex-compact` | `--text-sm` | Corpo curto. |
| `text-lex-caption` | `--text-caption` | Filas, caption. |
| `text-lex-section` | `--text-section-title` | H2 em cartão. |
| `text-lex-metric` | `--text-control` | Headline métrica. |
| `text-lex-card-title` | `--text-readable` | Título em card de lista + `md:text-lg`. |
| `text-lex-cta` | `--text-control` | `.lex-glass-cta`, alinhado ao botão default. |
| `text-lex-badge` / `text-lex-badge-em` | `--text-caption` | Pills importantes. |
| `text-lex-phase` | `--text-micro` | H3 de fase uppercase curto. |
| `text-lex-ultra` | `--text-micro` | Densidade extrema (ex.: miniatura); não menor que micro na prática. |

Relatório P1 (varredura, decisões, pendências): [DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md). Inventário residual amplo: [DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md](./DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md).

---

## 3. Papéis semânticos (o que usar em UI nova)

Use estes **papéis** em vez de valores arbitrários sempre que possível. Cores: combinar com `--text-primary` / `--text-secondary` / `--text-muted` (ver DS principal).

| Papel | Diretriz | Exemplo de classes / API |
|-------|-----------|---------------------------|
| **Título de página** | Maior hierarquia da rota | `.lex-page-title` (`src/app/globals.css`) |
| **Lead / intro** | Um parágrafo sob o título | `.lex-page-lead` |
| **Título de secção (cartão)** | H2 dentro de `.lex-glass-card` | `text-section font-medium` ou `lexTypeSectionHeadingClassName` / `text-lex-section` |
| **Rótulo de subsecção** | UPPERCASE curto, decorativo | `lexTypePhaseHeadingClassName` ou `text-micro` + `font-semibold` (evitar `font-bold` em tamanho mínimo) |
| **Corpo / lista principal** | Frases jurídicas funcionais | **Mínimo `text-sm` (14px)** ou `text-base` |
| **Descrição secundária** | Apoio ao título | `text-sm` ou `text-caption` + `--text-secondary` |
| **Metadado / data** | Linha curta importante | `text-caption` ou `text-sm` + contraste suficiente; **não** `text-muted` em informação crítica |
| **Micro** | Só denso / decorativo | `text-micro`; **não** status, erro, CTA, nome de caso, próxima ação |
| **CTA em vidro** | Botão/link glass | `.lex-glass-cta` (`text-control` / `text-lex-cta`) |
| **Label de formulário** | Sempre legível | `Label` shadcn: `text-sm font-semibold` |
| **Valor de campo** | Leitura e toque | `Input` / `Textarea`: `text-base` |
| **Erro / instrução** | Frase | `text-sm` mínimo; **nunca** `text-micro` |

### Regras de legibilidade

1. Texto jurídico **funcional** (motivos, alertas, próxima ação, fase relevante, nome de caso): **≥ 14px** (`text-sm` ou superior).
2. Metadados importantes: **≥ 13px** (`text-caption` / `text-xs`).
3. `text-micro` (11px): apenas labels **uppercase curtos**, tags decorativas ou indicadores muito secundários; contrastar bem se combinado com muted.
4. **Proibido** `text-[10px]` e similares para conteúdos listados na secção 3 (status, erro, CTA, etc.).
5. Em pills longas (ex.: estados de fluxo), usar `whitespace-nowrap` + largura mínima ou `tracking-tight` quando necessário.

---

## 4. Mapa por secção e subsecção (app)

Valores indicados são os **alvos documentados**; algumas rotas ainda têm `text-[Npx]` históricos — alinhar gradualmente a esta tabela.

### 4.1 Shell

| Secção | Subsecção | Tamanho / notas | Referência |
|--------|-----------|-----------------|------------|
| **Topbar** | Linha do escritório | `text-lex-eyebrow` → `md:text-lex-eyebrow-lg` uppercase | `app-topbar.tsx` |
| **Topbar** | Título da página (H1) | `text-base` → `md:text-lg` → `lg:text-xl` | idem |
| **Topbar** | Atalho ⌘K | `text-lex-rail` | idem |
| **Sidebar** | Itens de navegação | `text-base font-semibold` | `app-sidebar.tsx` |
| **Sidebar** | Grupos / rodapé | `text-sm` / `text-xs` conforme componente | `sidebar-account-footer.tsx` |
| **Command menu (⌘K)** | Tipo de resultado | `text-xs` muted | `command-menu.tsx` |
| **Command menu** | Subtítulo | `text-xs` | idem |

### 4.2 Página genérica `(app)`

| Secção | Subsecção | Tamanho / notas | Referência |
|--------|-----------|-----------------|------------|
| **Cabeçalho** | Título | `text-3xl` / `md:text-[2rem]` | `.lex-page-title`, `globals.css` |
| **Cabeçalho** | Lead | `text-base` relaxed | `.lex-page-lead` |
| **Ações** | CTA vidro | `text-control` semibold | `.lex-glass-cta`, `lex-ds.ts` |

### 4.3 Formulários

| Secção | Subsecção | Tamanho | Referência |
|--------|-----------|---------|------------|
| **Campo** | Label | `text-sm` semibold | `components/ui/label.tsx` |
| **Campo** | Input / textarea | `text-base` | `input.tsx`, `textarea.tsx` |
| **Campo** | Placeholder | cor `--placeholder-foreground` | tokens |

### 4.4 Botões (shadcn)

| Variante | Tamanho de texto | Referência |
|----------|------------------|------------|
| Default | `text-control` (15px) | `button.tsx` |
| `sm` | `text-sm` (mínimo 14px) | idem |
| `lg` | `text-base` | idem |

### 4.5 Dashboard — briefing (home)

Implementação alinhada a tokens P1, `text-lex-*` e `lex-ds` (`morning-briefing.tsx`, `next-actions-card.tsx`): cartões pulso, H2 de secção, fases, fila de ações, copiloto, badges de fluxo.

| Secção | Subsecção | Utilitário / constante |
|--------|-----------|-------------------------|
| **Pulso** | Label do cartão | `text-micro` uppercase (decorativo) |
| **Pulso** | Headline | `text-control` / `lexTypeMetricHeadlineClassName` |
| **Pulso** | Linhas · | `text-caption` ou `text-sm` / `lexTypeMetricDetailClassName` |
| **O que fazer agora** | H2 | `text-section` / `lexTypeSectionHeadingClassName` |
| **O que fazer agora** | Título do item | `text-sm` mínimo / `lexTypeQueueItemTitleClassName` |
| **Casos por fluxo** | Título fase (curto) | `text-micro` uppercase |
| **Casos por fluxo** | Nome do caso | `text-sm` ou `text-base` |
| **Casos por fluxo** | Estado / próxima ação | `text-caption` ou `text-sm` |
| **Casos por fluxo** | Badge importante | `text-caption`, não `text-[10px]` |
| **Atividade recente** | Hora | `text-caption` |
| **Atividade recente** | Descrição | `text-sm` |
| **Copiloto** | Título / mensagem | `text-sm` |
| **Próximas ações** (card) | Secção / hints | `text-sm`; badges CF/ADCT curtos: `text-micro` |

Lista de casos / documentos: título do card com `lexTypeCardTitleClassName` (`cases/page.tsx`, `documentos/page.tsx`).

### 4.6 Cartões e listas (referência Casos)

| Secção | Diretriz |
|--------|----------|
| Título de cartão na grelha | `lexTypeCardTitleClassName` ou `text-sm` / `text-base` semibold + `--text-primary` |
| Metadados (área, data) | `text-xs` + `--text-muted` |
| Corpo dentro de cartão | `text-sm` mínimo para parágrafos curtos |

(Detalhe em [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §7.)

---

## 5. Checklist para novas telas

- [ ] Título de página: `.lex-page-title` + opcional `.lex-page-lead`.
- [ ] Títulos dentro de cartão: `lexTypeSectionHeadingClassName` ou `text-lex-section`.
- [ ] Corpo: `text-sm` ou `text-base`; nunca `text-micro` / pills pequenas para parágrafos longos.
- [ ] UPPERCASE curto: `text-micro` ou `lexTypePhaseHeadingClassName` + tracking moderado.
- [ ] Inputs: `text-base`; labels: `text-sm` semibold.
- [ ] Cores de texto: tokens `--text-*`, não `zinc-*` soltos.
- [ ] Testar **dark** e **light**.

---

## 6. Evolução recomendada (código)

1. Reduzir o inventário em [DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md](./DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md) migrando ficheiro a ficheiro (prioridade: tabs de caso, busca jurídica, retrieval).
2. Código novo: preferir `text-micro` … `text-readable` em vez de `text-[Npx]`.
3. Ajustes globais de densidade: alterar `--text-micro` … `--text-readable` (e, se necessário, o mapeamento `--lex-type-*`) e validar briefing + casos + topbar num único passo visual.

---

## 7. Ficheiros de referência

| Ficheiro | Conteúdo |
|----------|----------|
| `src/app/globals.css` | `--text-micro` … `--text-readable`, `--lex-type-*`, `--lex-lh-*`, `--text-*`, `.lex-page-title`, `.lex-glass-cta` |
| `tailwind.config.ts` | `fontSize` → `text-micro` … `text-readable` + `text-lex-*` |
| `src/lib/lex-ds.ts` | Constantes `lexType*` |
| `docs/DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md` | Varredura P1, decisões, critérios de aceite |
| `docs/DESIGN_SYSTEM_TYPOGRAPHY_P1_QA.md` | QA visual pós-P1, quebras corrigidas, pendências |
| `docs/DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md` | Inventário residual `text-[Npx]` |
| `src/components/dashboard/morning-briefing.tsx` | UI migrada (referência) |
| `src/components/app/app-topbar.tsx` | Eyebrow migrado |
| `src/components/ui/label.tsx`, `input.tsx` | Formulários |
