# Lex — P1 tipografia: QA de fecho (sem agenda)

Este documento cobre **apenas** o pacote de tipografia P1. **Não inclui** validação nem alterações em:

- `/agenda`, `CalendarEvent`, Prisma de calendario, `src/components/calendar/*`, `src/app/(app)/agenda/*`, `DashboardCalendarCards`, botão «Concluir» de evento.

## Método

- Regras de tamanho e tokens: [DESIGN_SYSTEM_TYPOGRAPHY.md](./DESIGN_SYSTEM_TYPOGRAPHY.md).
- Inventário residual de `text-[Npx]`: [DESIGN_SYSTEM_TYPOGRAPHY_P1_REMAINING.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_REMAINING.md).

## Rotas alvo (tipografia / shell)

| Rota | Notas |
|------|--------|
| `/dashboard` | Métricas do header (`processos` / `movimentações` / `alertas`) alinhadas a `text-caption` no working tree; ficheiro pode partilhar diff com **cartões de agenda** — ver política de commit em [DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md). |
| `/cases/new`, `/cases/[id]` | Intro da visão geral do caso: `text-micro` + `text-sm` para copy funcional. |
| `/documentos`, `/processos`, `/processos/[id]` | Badges e meta: `text-caption` + `whitespace-nowrap` onde aplicável. |
| `/settings/integracoes` | Já em `text-sm` / `text-base` na listagem; sem `text-[Npx]` nesta rota. |
| `/settings/team` | Nota enterprise + badge de papel: `text-sm` / `text-caption`. |
| `/publicacoes` | `<select>` do formulário: `text-base` (alinhado a inputs). |

## Shell (todas as rotas)

- **Topbar:** grelha `md+` e título sem `max-w` extra; `title` em truncates — [globals.css](../src/app/globals.css), [app-topbar.tsx](../src/components/app/app-topbar.tsx).

## Erros globais

- `error.tsx` / `global-error.tsx`: linha `ref:` com `text-caption` (metadado legível).

## Smoke manual recomendado

Dark/light, largura &lt; 768px e ≥ 1280px, em `/cases`, `/documentos`, `/processos`, `/publicacoes`, `/settings/integracoes`.
