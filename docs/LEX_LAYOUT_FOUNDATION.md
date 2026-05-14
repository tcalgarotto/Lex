# Lex — fundação de layout (P1)

Desktop-first: prioridade notebook/monitor; mobile só com compatibilidade mínima (sem overflow horizontal agressivo).

## Componentes

### `LexPageFrame` (`src/components/layout/lex-page-frame.tsx`)

- **Sem rails:** trilho central com `max-width` alinhado aos tokens (`--lex-content-default` ou `wide` / `full`).
- **Com `rightRail` / `leftRail` (sem bleed):** classes `lex-layout-constrained-*` — o centro partilha a largura útil com o rail dentro do poço do `AppChrome` (evita somar dois caps de “faixa central”).
- **Com `bleed`:** grelha `1fr | centro | 1fr` (`.lex-layout-three-well` + `data-lex-tracks`), alinhada ao header; usada pela Agenda via `LexAgendaShell`.

### `LexCenterGrid` (`src/components/layout/lex-center-grid.tsx`)

Grelha responsiva (1 → 2 → 4 colunas) com gap `--lex-page-gap`. Filhos usam `col-span-full`, `md:col-span-*`, `xl:col-span-*`.

### Tokens (`src/app/globals.css`)

- `--lex-content-default`, `--lex-content-wide`, `--lex-content-full`
- `--lex-page-gap`, `--lex-center-grid-columns`, `--lex-rail-right-max`
- `--lex-center-track` (three-well + modificadores wide/full)

## Quando usar `centerWidth`

| Valor     | Uso típico                                      |
|----------|--------------------------------------------------|
| `default`| Formulários, detalhe de caso, settings          |
| `wide`   | Listas densas, documentos, processos, dashboard |
| `full`   | Só quando o poço precisa ocupar 100% do centro |

## Rails

- **`leftRail` / `rightRail`:** nós React empilháveis; em bleed são filhos diretos do grid (sem wrapper extra).
- **Detalhe do caso:** `CaseDetailRightRail` empilha cartões no rail direito; basta acrescentar irmãos junto do `CaseCopilotPanel` em `cases/[id]/layout.tsx`.

Exemplo:

```tsx
<LexPageFrame
  centerWidth="default"
  rightRail={
    <CaseDetailRightRail>
      <CaseCopilotPanel {...} />
      {/* <CaseOutroCard /> — futuro; só JSX, sem CSS global novo */}
    </CaseDetailRightRail>
  }
>
  <CaseMainContent />
</LexPageFrame>
```

Com grelha central de cards:

```tsx
<LexPageFrame centerWidth="wide" rightRail={<AsideCards />}>
  <LexCenterGrid>
    <Card className="col-span-full xl:col-span-2" />
    <Card className="col-span-full xl:col-span-2" />
    <Card className="col-span-full xl:col-span-4" />
  </LexCenterGrid>
</LexPageFrame>
```

## Bleed

Só com `bleed` no `LexPageFrame` **e** `getPageLayoutConfig(path).bleed === true` no `AppChrome` (padding/max-width do poço). Hoje: **`/agenda`**. Novas rotas bleed: registar em `src/lib/layout/page-layout-config.ts`.

## Configuração por rota

`matchRouteLayout(pathname)` em `src/lib/layout/page-layout-config.ts` devolve decisão explícita (`frame`, `centerWidth`, rails esperados, notas). `getPageLayoutConfig` expõe apenas `bleed` / `contentMode` para o shell.

## Modelo futuro (drag / resize)

Ver comentário no topo de `lex-page-frame.tsx`: zonas `leftRail` | `center` | `rightRail`; no centro `x ∈ [0,3]`, `w ∈ [1,4]`; widgets sem atravessar zonas; persistência `{ id, zone, x, y, w, h, variant? }`. Não implementado na P1.

## Auditoria de rotas `(app)` (síntese)

| Rota (padrão) | LexPageFrame | LexCenterGrid | centerWidth | leftRail | rightRail | Onde |
|---------------|-------------|---------------|-------------|----------|-----------|------|
| `/agenda` | sim (shell) | não | wide (trilho) | sim | sim | `lex-agenda-shell` |
| `/dashboard` | sim | sim | wide | não | não | `dashboard/layout.tsx` |
| `/cases` | sim | não | wide | não | não | `cases/page.tsx` |
| `/cases/new` | sim | não | wide | não | não | `cases/new/page.tsx` |
| `/cases/[id]/*` | sim | não | default | não | sim | `cases/[id]/layout.tsx` |
| `/processos`, `/processos/analytics` | sim | não | wide | não | não | `processos/layout.tsx` |
| `/processos/[id]/*` | sim | não | wide | opcional | opcional | idem (conteúdo em abas) |
| `/documentos` | sim | não | wide | não | não | `documentos/layout.tsx` |
| `/biblioteca/*` | sim | não | wide | não | não | `biblioteca/layout.tsx` |
| `/publicacoes` | sim | não | default | não | não | `publicacoes/layout.tsx` |
| `/settings/*` | sim | não | default | não | não | `settings/layout.tsx` |
| `/pesquisa-juridica` | sim | não | wide | não | não | `pesquisa-juridica/layout.tsx` |
| `/busca` | sim | não | wide | não | não | `busca/layout.tsx` |
| `/editor/*` | sim | não | wide | não | não | `editor/layout.tsx` |
| `/cockpit` | sim | não | default | não | não | `cockpit/layout.tsx` |
| `/strategy` | sim | não | default | não | não | `strategy/layout.tsx` |
| `/demo`, `/test-guide`, `/apresentacao` | sim | não | default | não | não | `*/layout.tsx` |
| `/casos/[id]` | não (redirect) | — | — | — | — | redirect para `/cases/[id]` |
| `/retrieval` | não | — | — | — | — | redirect |

Rotas não listadas na tabela caem no **default** de `matchRouteLayout` (standard, `default`, LexPageFrame recomendado — migrar com segment layout quando fizer sentido).

## QA manual sugerido

Com sidebar aberta/fechada: verificar `/dashboard`, `/agenda`, `/cases/[id]`, `/processos`, `/processos/[id]`, `/documentos`, `/publicacoes`, `/settings/integracoes` — centro estável, sem overflow horizontal, topbar alinhada.

**Build de produção:** com `next dev` a correr no mesmo projeto, `npm run build:clean` pode falhar (`.next` partilhado; erros como `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`). Parar o servidor de desenvolvimento, remover `.next` se necessário, e voltar a executar o build uma vez.
