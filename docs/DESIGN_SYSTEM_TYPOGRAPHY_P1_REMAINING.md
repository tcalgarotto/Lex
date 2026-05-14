# Lex — P1 tipografia: ocorrências `text-[Npx]` remanescentes (classificação)

Varredura em `src/**/*.tsx` por `text-\[(10|10\.5|11|11\.5|12|13|13\.5)px\]`. **Fora do commit P1 fechado:** pastas `src/components/calendar/`, `src/app/(app)/agenda/`, APIs de calendário, e `dashboard/page.tsx` quando o diff incluir cartões de agenda.

## Legenda

| Classe | Significado |
|--------|-------------|
| **D** | Decorativa (uppercase curto, pill densa, mono técnico) |
| **T** | Técnica / densidade (SVG, trace id, URN, debug) |
| **F** | Funcional (instrução, aviso, erro, label de filtro) — **prioridade para migrar** a `text-caption` / `text-sm` |

## Ficheiros com maior contagem (resumo)

| Ficheiro | Contagem aprox. | Notas |
|----------|-------------------|--------|
| `legal-search-panel.tsx` | 17 | Misto F/D — labels de camada, mensagens, badges |
| `case-drafts-tab.tsx` | 17 | Fora do lote deste commit |
| `case-data-origin.tsx` | 12 | Metadados |
| `global-pesquisa-workbench.tsx` | 11 | Labels de filtro (F) |
| `case-overview-tab.tsx` | 10 | Misto |
| `retrieved-chunk-card.tsx` | 10 | T/D predominante |
| `case-research-tab.tsx` | 9 | Avisos AI (F) |
| `case-strategy-pieces-tab.tsx` | 10 | |
| `strategy-card.tsx` | 10 | |
| `office-memory-panel.tsx` | 8 | Badges curtos (D) + parágrafo (F) |
| `case-checklist-tab.tsx` | 5 | |
| `case-timeline-tab.tsx` | 3 | |
| `process-chat.tsx` | 7 | |
| `reasoning-trace.tsx` | 7 | Técnico |
| `calendar-event-list.tsx` | *excluído* | Pacote agenda — não migrar neste fecho |

## Manter (exemplos típicos)

- **SVG** (`precedent-map.tsx`): texto anotado no diagrama — rever com design, não só token.
- **Mono URN** curto em cartões de retrieval: pode permanecer pequeno com `title` e contraste verificado.
- **Marketing** `page.tsx`: escala própria; ainda assim evitar corpo &lt; 13px para microcopy jurídica.

## Próximo passo

Migrar por área (tabs de caso, busca, retrieval) usando [DESIGN_SYSTEM_TYPOGRAPHY.md](./DESIGN_SYSTEM_TYPOGRAPHY.md); atualizar contagens após cada PR.
