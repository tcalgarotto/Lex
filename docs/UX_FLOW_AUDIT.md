# UX Flow Audit — Caso (P0 Lane C)

**Status:** F-1 sign-off provisório. Release público bloqueado. Owners Legal / Security / QA Lead: **PROVISÓRIO** (dupla revisão Thales PO + Cursor CTO interim).

## Atualização (2026-05-12)

- Pesquisa do caso: pins assistidos aparecem em **Estratégia e peças** via espelho `CaseLegalSource`.
- Estratégia: `POST /api/cases/[id]/strategy` gera `draftingStrategy` com **DeepSeek**, sem `retrieveLegalContext`.
- Minuta: `POST /api/cases/[id]/drafts` chama `generateDraft` (DeepSeek). Botão **Editor final** → `POST .../drafts/[draftId]/promote` → `/editor/[pieceId]`.

## Fluxo canônico (6 seções)

Ordem fixa na subnavegação persistente (`CaseSubnav`):

1. **Visão geral** — `/cases/[id]` — progresso, narrativa, próximos passos, **atividades** (linha do tempo + colaboração).
2. **Entrevista guiada** — `/cases/[id]/entrevista` — `CaseChecklistTab` (API `/api/cases/[id]/checklist`, Lane B).
3. **Partes e fatos** — `/cases/[id]/partes-fatos` — `CaseFactsPartiesTab` (CRUD inline existente: facts, parties, requests, risks via rotas `/api/cases/[id]/*`).
4. **Documentos** — `/cases/[id]/documentos` — `CaseDocumentsTab` (upload, status, texto extraído em diálogo, atalhos para estratégia/partes).
5. **Pesquisa jurídica** — `/cases/[id]/pesquisa-juridica` — `CaseResearchTab` em `src/components/cases/research/case-research-tab.tsx` (Case Brain resumido + recomendações + `LegalSearchPanel`).
6. **Estratégia e peças** — `/cases/[id]/estrategia` — lazy via `EstrategiaLazy` → `CaseStrategyPiecesTab` (**Lane D**; não editar nesta lane).

## Compatibilidade

- Links antigos `?tab=` são redirecionados por `CaseLegacyQueryRedirect` para a rota equivalente.
- **Fora desta lane (TODO Lane E):** `src/lib/dashboard/next-actions.ts` ainda referencia `?tab=strategy` — atualizar para `/cases/[id]/estrategia`.

## Página global

- **`/pesquisa-juridica`** — `GlobalPesquisaWorkbench`: busca com debounce 250 ms, abas de filtro (Todos · Leis · Jurisprudência · Teses · Estratégia), filtros em cartão, resultados + painel lateral assistido, mensagem de transparência DeepSeek (`USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP`).

## Terminologia (PARTE 12)

- Fonte: `src/lib/ui/product-terminology.ts` — `PRODUCT_TERMINOLOGY`, `translateTerm`, `USER_FACING_MESSAGES`.
- **Regra:** não exibir ao usuário comum strings com jargão interno (ex.: nomes de infraestrutura técnica); usar tradução ou mensagem canônica.
- **Divergência intencional:** a mensagem obrigatória do prompt que citava “RAG interno” foi adaptada para **“A pesquisa interna no acervo…”** (mesmo significado, sem sigla na UI).

## Dados: Case Brain → UI

| Fonte | Uso na UI |
|-------|-----------|
| `Case.metadataJson.brain.narrative` | Resumo contextual na aba pesquisa; empty state se sem narrativa **e** sem `rawInput` **e** sem entidades |
| `facts`, `parties`, `requests`, `risks`, `documents` (Prisma) | Chips de contagem, corpo da aba pesquisa, empty states |
| `POST /api/legal-research/recommend-for-case` | Sugestões (Lane A). **404/501:** UI degrada com cartão informativo (sem stack). |
| `POST /api/legal-research/pin` | Fixar fundamento. **404/501:** aviso amigável (stub). |

## Acessibilidade (WCAG AA — baseline)

- `aria-current="page"` nos links da subnav; `aria-label` em botões só-ícone; `role="alert"` / `aria-live="polite"` em erro/loading onde aplicável.
- Foco visível: classes `focus-visible:ring-*` nos links da subnav e CTAs principais.

## Stubs / swaps pendentes (Lane E + orquestração)

| Stub | Ação |
|------|------|
| `POST /api/legal-research/recommend-for-case` | Implementar (Lane A); contrato esperado: `{ result: LegalResearchResponse }` |
| `POST /api/legal-research/pin` | Implementar (Lane A) |
| `CaseResearchTab` → “Adicionar à estratégia” | Integrar com Case Brain / Lane D |
| Import canônico Lane D | Documentado: hoje `EstrategiaLazy` importa `CaseStrategyPiecesTab`. Se Lane D publicar barrel (`case-drafting-tab`), trocar só o dynamic import em `estrategia-lazy.tsx`. |

## Arquivos tocados (Lane C)

- `src/app/(app)/cases/[id]/layout.tsx`, `_load-case.ts`, `page.tsx`, `entrevista/page.tsx`, `partes-fatos/page.tsx`, `documentos/page.tsx`, `pesquisa-juridica/page.tsx`, `estrategia/page.tsx`
- `src/app/(app)/pesquisa-juridica/page.tsx`
- `src/components/cases/case-subnav.tsx`, `case-legacy-query-redirect.tsx`, `estrategia-lazy.tsx`, `global-pesquisa-workbench.tsx`
- `src/components/cases/research/case-research-tab.tsx`
- `src/components/cases/case-research-tab.tsx` (re-export)
- `src/components/cases/case-overview-tab.tsx`, `case-documents-tab.tsx`, `case-tabs.tsx`
- `src/lib/ui/product-terminology.ts`
- `docs/UX_FLOW_AUDIT.md`

## Riscos abertos

- **Tabs Radix:** na pesquisa global, conteúdo de resultados fica **fora** de `TabsContent` para evitar mismatch de `value`; apenas `TabsList` + estado `tab` controla o filtro.
- **Dark theme:** referência HTML era clara; a UI segue o shell escuro existente (`AppShell`), com cartões `bg-card` e bordas suaves como padrão equivalente.

## Confirmações de processo

- **Lint / typecheck / build / test:** não executados nesta lane (instrução Lane E).
- **Previews HTML:** não foram copiados assets, scripts, marca nem classes proprietárias; apenas padrões (hierarquia, cartões, busca ampla, painel lateral).
