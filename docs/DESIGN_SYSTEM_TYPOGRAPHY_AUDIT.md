# Lex — Auditoria de tipografia (`text-[Npx]` e hierarquia)

Inventário para apoiar tokens em `globals.css` (`--text-micro` … `--text-readable`, `--lex-type-*`) e utilitários Tailwind. **Atualizado:** maio 2026 (P1). Varredura detalhada das rotas prioritárias: [DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_SCAN.md).

---

## 1. Fonte de verdade (dois níveis)

**Nível A — tokens semânticos P1** (`--text-micro` … `--text-readable`, utilitários `text-micro` … `text-readable`). Ver secção 2 de [DESIGN_SYSTEM_TYPOGRAPHY.md](./DESIGN_SYSTEM_TYPOGRAPHY.md).

**Nível B — compat `text-lex-*`:** `--lex-type-*` em `:root` **mapeia** para os tokens P1 (ex.: métrica e CTA → `--text-control`, badges → `--text-caption`, micro/rail/phase → `--text-micro`). Código legado com `text-lex-*` continua coerente ao ajustar apenas `globals.css`.

**Constantes compostas:** `src/lib/lex-ds.ts` — `lexTypeSectionHeadingClassName`, `lexTypePhaseHeadingClassName`, etc.

---

## 2. Ficheiros já alinhados (P1 + migrações anteriores)

| Área | Ficheiros (exemplos) |
|------|----------------------|
| Tokens + vidro | `src/app/globals.css`, `tailwind.config.ts`, `.lex-glass-cta` |
| Botão | `src/components/ui/button.tsx` (`text-control`) |
| Shell | `app-topbar.tsx`, `theme-toggle.tsx` |
| Dashboard | `morning-briefing.tsx`, `next-actions-card.tsx`, `dashboard/page.tsx` |
| Casos | `cases/page.tsx`, `cases/[id]/*`, `case-progress.tsx`, `fundamental-intake-chrome.tsx`, `legal-form.tsx` |
| Documentos | `documentos/page.tsx`, `document-upload-button.tsx`, `document-row-actions.tsx`, `document-pdf-thumbnail.tsx` |
| Processos | `processos/page.tsx`, `processos/[processId]/page.tsx`, `processos/.../documentos/[documentId]/page.tsx`, `process-virtual-list.tsx` |

---

## 3. Inventário residual: `text-[10px]`–`text-[13.5px]` (TSX)

Contagem por ficheiro (grep em `src/**/*.tsx`). Migrar para `text-micro` / `text-caption` / `text-sm` / `text-lex-*` conforme [DESIGN_SYSTEM_TYPOGRAPHY.md](./DESIGN_SYSTEM_TYPOGRAPHY.md).

| # | Ficheiro |
|---|----------|
| 17 | `src/components/legal-search/legal-search-panel.tsx` |
| 17 | `src/components/cases/case-drafts-tab.tsx` |
| 12 | `src/components/cases/case-data-origin.tsx` |
| 11 | `src/components/cases/global-pesquisa-workbench.tsx` |
| 10 | `src/components/cases/case-overview-tab.tsx` |
| 10 | `src/components/cases/case-parties-tab.tsx` |
| 10 | `src/components/cases/case-strategy-pieces-tab.tsx` |
| 10 | `src/components/retrieval/strategy-card.tsx` |
| 10 | `src/components/retrieval/retrieved-chunk-card.tsx` |
| 9 | `src/components/cases/research/case-research-tab.tsx` |
| 8 | `src/components/biblioteca/office-memory-panel.tsx` |
| 7 | `src/components/cases/case-risks-tab.tsx` |
| 7 | `src/components/cases/case-requests-tab.tsx` |
| 7 | `src/components/chat/process-chat.tsx` |
| 7 | `src/components/retrieval/reasoning-trace.tsx` |
| 6 | `src/app/(app)/cockpit/page.tsx` |
| 6 | `src/components/retrieval/legal-timeline.tsx` |
| 6 | `src/components/cases/case-readiness-card.tsx` |
| 5 | `src/components/cases/case-checklist-tab.tsx` |
| 5 | `src/app/(app)/strategy/page.tsx` |
| 4 | `src/components/calendar/calendar-event-list.tsx` |
| 4 | `src/components/workspace/workspace-storage-indicator.tsx` |
| 4 | `src/components/retrieval/issues-list.tsx` |
| 22 | `src/app/(marketing)/page.tsx` |
| … | Outros ficheiros com 1–4 ocorrências (calendário, settings/team, busca, editor, biblioteca, etc.) — voltar a correr grep após migrações. |

**Valores típicos a eliminar:** `10px`, `11px`, `11.5px`, `12px`, `13px`, `13.5px` em classes arbitrárias.

---

## 4. Hierarquia recomendada (resumo)

1. **Página** — `.lex-page-title` / `.lex-page-lead`
2. **Secção em cartão** — `text-section` / `text-lex-section` / `lexTypeSectionHeadingClassName`
3. **Subsecção / fase (curta)** — `text-micro` + uppercase / `lexTypePhaseHeadingClassName`
4. **Título de item em lista** — `text-sm` mínimo / `lexTypeQueueItemTitleClassName` / `lexTypeCardTitleClassName`
5. **Corpo** — `text-sm`, `text-base`
6. **Metadado** — `text-caption` / `text-xs`, `text-lex-caption`, `text-lex-rail`
7. **CTA / botão default** — `text-control`, `.lex-glass-cta`
8. **Pills importantes** — `text-caption` / `text-lex-badge`
9. **Micro** — `text-micro` só decorativo curto; não parágrafos

---

## 5. Próximos passos (migração)

1. Substituir blocos repetidos (badges `text-[10px]`, labels `text-[11px]`) por `text-caption` / `text-sm` / `text-lex-badge`.
2. Componentes de **retrieval / strategy** — alinhar a `text-caption` + `text-sm` para texto corrido.
3. **Marketing** — rever `page.tsx`; microcopy com mínimos de legibilidade.
4. Após cada migração, atualizar contagens na secção 3 deste ficheiro.
