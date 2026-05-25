# JustOS — Auditoria layout dashboard (2026-05-25)

## Baseline (pré-refatoração)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ver CI local |
| `npm run lint` | verde pós-fixes recentes |
| `npm test` | verde (integração DB opcional skip) |
| `npm run build` | executado na Fase 12 |

## Lógica de sidebar colapsável

| Arquivo | Risco | Ação |
|---------|-------|------|
| `src/stores/ui-store.ts` | Alto | Remover `sidebarCollapsed`, `toggleSidebar`, `setSidebarCollapsed` |
| `src/components/app/app-sidebar.tsx` | Alto | Largura fixa 248px; remover botão PanelLeft |
| `src/components/app/app-shell.tsx` | Alto | `ml` fixo; remover `useMobileShellDefaults` collapse |
| `src/components/app/app-topbar.tsx` | Médio | Faixa marca alinhada à sidebar fixa |
| `src/components/cases/fundamental-intake-form.tsx` | Médio | Inset fixo 248px |
| `src/components/app/sidebar-account-footer.tsx` | Baixo | Remover modo `collapsed` |
| `src/components/ui/theme-toggle.tsx` | Baixo | Prop `collapsed` só sidebar — manter compact |
| `src/components/app/workspace-switcher.tsx` | Baixo | Prop `collapsed` — sempre expandido |

**Persistência:** nenhum `localStorage`/`cookie` para sidebar collapse (apenas tema).

## Rails expansíveis

| Arquivo | Notas |
|---------|-------|
| `src/app/globals.css` | `--lex-rail-*`, `.lex-layout-three-well`, `.dashboard-briefing-layout` |
| `src/components/layout/lex-page-frame.tsx` | Rails opcionais por rota (casos, agenda) — **mantidos** onde há conteúdo |
| `src/components/dashboard/morning-briefing.tsx` | `rightRailRest` + grid 2 colunas — **substituído** por dashboard ágil |
| `src/app/(marketing)/layout.tsx` | N/A |

## Dashboard

| Arquivo | Ação |
|---------|------|
| `src/app/(app)/dashboard/layout.tsx` | Remover `LexPageFrame`/`LexCenterGrid` — full width |
| `src/app/(app)/dashboard/page.tsx` | Novo `JustosDashboardPage` |
| `src/lib/dashboard/dashboard-service.ts` | **Novo** agregador |
| `src/components/dashboard/justos-dashboard-*.tsx` | **Novos** |
| `src/app/api/dashboard/cases/[id]/stage/route.ts` | **Novo** PATCH stage |

## Plano de remoção

1. Sidebar fixa global → todas as rotas `(app)`.
2. Dashboard sem poço 70% / rails vazios.
3. Kanban com `@dnd-kit` em ilha client.
4. E2E `justos-dashboard-layout.spec.ts`.

## Riscos

- Intake fullscreen usa `--app-main-inset` — atualizar para token.
- Topbar deve alinhar com 248px em desktop.
- Casos/agenda com `LexPageFrame` rightRail **não** alterados nesta entrega (só dashboard + shell).
