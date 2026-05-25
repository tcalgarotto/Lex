# JustOS — Dashboard ágil refactor (2026-05-25)

## Resumo

Refatoração do `/dashboard` e do shell global: sidebar **sempre expandida** (248px), área de conteúdo **full-width**, cockpit com métricas, fila “O que fazer agora”, **quadro horizontal** com drag-and-drop (`@dnd-kit`) e painel lateral (copiloto, ações rápidas, agenda).

## Antes → Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Sidebar | Colapsável 80px / 268px + botão | Fixa `--app-sidebar-width: 248px` |
| Conteúdo app | Poço ~70% + rails `1fr` | `100vw - sidebar - gutters` |
| Dashboard | `MorningBriefing` + rails 2 colunas | `JustosDashboardView` full-width |
| Casos por fluxo | Lista vertical em fases | Kanban 9 colunas + DnD |
| JS layout | `transition-[margin]`, zustand collapse | Removido |

## Arquivos principais

- `src/stores/ui-store.ts` — só `sidebarMobileOpen` + command palette
- `src/components/app/app-sidebar.tsx`, `app-shell.tsx`, `app-topbar.tsx`
- `src/app/globals.css` — `--app-sidebar-width`, well full-width
- `src/styles/justos-dashboard.css`
- `src/lib/dashboard/dashboard-service.ts`, `dashboard-kanban.ts`
- `src/components/dashboard/justos-dashboard-view.tsx`, `dashboard-kanban-board.tsx`
- `src/app/(app)/dashboard/page.tsx`, `layout.tsx`
- `src/app/api/dashboard/cases/[id]/stage/route.ts`
- `tests/e2e/justos-dashboard-layout.spec.ts` (projeto `dashboard-layout` + auth)

## Drag & drop

- Biblioteca: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Persistência: `metadataJson.dashboardKanbanColumn` via PATCH API
- Fallback: `<select>` “Mover para…” em cada card (teclado / sem pointer)

## Testes

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright test tests/e2e/justos-dashboard-layout.spec.ts --project=dashboard-layout
```

## Impeccable

Rodar localmente após deploy/dev:

```bash
npm run impeccable:detect
```

Meta documentada: ≥ 38/40. Pendente medição pós-merge no ambiente de preview.

## Pendências

- Virtualização do board se >50 cards por coluna
- Métricas “mensagens não lidas” quando API CRM estiver ligada ao resumo
- Screenshots em `reports/browser-captures/` após run Playwright com auth
- `morning-briefing.tsx` mantido para referência; não usado na rota `/dashboard`

## Comandos

```bash
cd /home/thales/Projetos/Lex
npm run dev:webpack -- --hostname 0.0.0.0 --port 3000
# Abrir http://127.0.0.1:3000/dashboard (login)
```
