# Feedback do advogado tester — 2026-05-10

> Os itens abaixo consolidam **sete** mensagens recorrentes do roteiro de teste com advogado e das auditorias de UX comercial (`docs/COMMERCIAL_UX_P0_AUDIT.md` §3) e do ADR DeepSeek (`docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md`). Não há transcrição literal única no repositório; esta lista é a **versão acordada para governança** do P0.

| # | Feedback (literal de intenção) | Solução implementada (resumo) | Onde |
|---|--------------------------------|----------------------------------|------|
| 1 | “Não sei onde estou na tela / no caso.” | Subnavegação por seção com rótulos em português; títulos por página de caso. | Lane C — `case-subnav.tsx`, páginas em `src/app/(app)/cases/[id]/*/page.tsx` |
| 2 | “Não sei qual é o próximo passo.” | Overview com próximos passos; dashboard `next-actions` aponta para rotas canônicas (`/cases/[id]/estrategia`, etc.). | Lane C + Lane E — `case-overview-tab.tsx`, `src/lib/dashboard/next-actions.ts` |
| 3 | “O produto fala como desenvolvedor (chunk, vetor…).” | Mapa de terminologia e mensagens de produto; teste de regressão em `tests/ui/case-flow.test.ts`. | `product-terminology.ts`, UX lanes anteriores |
| 4 | “Tela vazia não me orienta.” | Copy em pesquisa global/caso; estados vazios com CTAs. | Lane C — `global-pesquisa-workbench.tsx`, `case-research-tab.tsx` |
| 5 | “Caso e processo judicial se confundem.” | Fluxo pré-processual explícito em `/cases/new` (já existente); reforço nas docs de fluxo. | `docs/UX_FLOW_AUDIT.md`, `cases/new` |
| 6 | “Preciso de pesquisa útil mesmo quando o acervo interno ainda não fecha o benchmark.” | Modo temporário DeepSeek com transparência e avisos; recomendação por caso usa Case Brain + contrato `recommend-for-case`. | Lane A + B + C + E |
| 7 | “Não posso confundir sugestão da máquina com fundamento verificado.” | Hierarquia de verdade (nível 9b), `drafting-guard`, pin humano, marcação verificada só após ação explícita; jurisprudência sem número/URL como candidata. | `TRUTH_HIERARCHY.md`, `drafting-guard.ts`, rotas `pin` / `mark-verified` |
