# JustOS — Performance budget do dashboard

## Objetivo

Cockpit `/dashboard` com **mínimo JS de layout** e ilha client só no quadro (drag/drop).

## Baseline vs alvo

| Área | Antes | Depois |
|------|-------|--------|
| Sidebar collapse | Zustand + `transition-[margin]` no main | Removido — CSS fixo `--app-sidebar-width` |
| Poço central 70% | `--lex-app-central-well-calc` com 70% viewport | Largura útil = `100vw - sidebar - gutters` |
| Dashboard body | `morning-briefing` client + rails 2 colunas | Server `JustosDashboardView` + dynamic kanban |
| dnd-kit | — | Dynamic import só em `dashboard-kanban-board.tsx` |

## Regras

1. Não hidratar o dashboard inteiro por causa do board.
2. Dados iniciais via `getDashboardViewModel` (server).
3. PATCH `/api/dashboard/cases/[id]/stage` só ao mover card.
4. Sem listeners globais de resize para layout.

## Verificação

```bash
npm run build
# Inspecionar rotas /dashboard no output .next
```

Pendência: medir `First Load JS` da rota no relatório de build e registrar aqui após deploy de referência.
