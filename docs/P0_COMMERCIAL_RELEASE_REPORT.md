# P0 Commercial Release Report — Lex

> Relatório honesto de release P0 comercial (fluxo caso-cêntrico).  
> Última atualização: **2026-05-09** (rodada final F19–F25).

## 1. Resumo do que mudou

- **F19 — Memória do escritório (opt-in)**: modelo Prisma `OfficeMemory` com escopos `WORKSPACE` / `USER` / `CASE`, flags `useAsModel`, `useAsStyle`, `optInRag`, `private`, `originType`/`originId`, auditoria (`createdBy`/`updatedBy`, soft delete). API `/api/office-memory` e UI mínima em `/biblioteca/memoria`. Nada é promovido automaticamente para memória.
- **F20 — Painel “Origem dos dados”**: componente `CaseDataOriginButton` + `parseMetadataJson` em fatos, pedidos, riscos; para `CaseLegalSource` (sem `metadataJson` no schema) a origem é montada a partir de `excerpt`, `query`, `chunkId`, `pinnedById`, `createdAt`.
- **F21 / F23**: auditorias atualizadas com evidência em `docs/SECURITY_REVIEW_P0.md` e `docs/CODE_REVIEW_P0.md`.
- **Correção de segurança (defesa em profundidade)**: `buildCaseContext` / `fetchDocumentTexts` agora filtra `Document` por `workspaceId` além dos IDs vindos do caso (`src/lib/cases/context.ts`).

## 2. Telas alteradas

- `/biblioteca` — link “Memória (opt-in)” para `/biblioteca/memoria`.
- `/biblioteca/memoria` — nova página (lista + formulário de criação + toggles RAG/arquivar/excluir).
- `/cases/[id]` — abas Fatos, Pedidos, Riscos e Pesquisa jurídica: botão **Origem** (diálogo) por item.

## 3. Arquivos principais

| Área | Caminhos |
|------|-----------|
| DB | `prisma/schema.prisma`, `prisma/migrations/20260509220000_office_memory/migration.sql` |
| API memória | `src/app/api/office-memory/route.ts`, `src/app/api/office-memory/[id]/route.ts` |
| Regras visibilidade | `src/lib/office-memory/visibility.ts` |
| UI memória | `src/app/(app)/biblioteca/memoria/page.tsx`, `src/components/biblioteca/office-memory-panel.tsx`, `src/app/(app)/biblioteca/page.tsx` |
| F20 | `src/lib/cases/data-origin-meta.ts`, `src/components/cases/case-data-origin.tsx`, `case-facts-tab.tsx`, `case-requests-tab.tsx`, `case-risks-tab.tsx`, `case-research-tab.tsx` |
| Contexto caso | `src/lib/cases/context.ts` |
| Testes | `tests/integration/office-memory.test.ts`, `tests/e2e/05-api-auth-required.spec.ts` |
| Docs | `docs/SECURITY_REVIEW_P0.md`, `docs/CODE_REVIEW_P0.md`, este relatório |

## 4. Bugs corrigidos

- **IDOR em profundidade no contexto do caso**: leitura de texto de documentos para RAG/drafting ignorava `workspaceId` no `findMany` de `Document` — corrigido para `{ workspaceId, id: { in: documentIds } }`.

## 5. Riscos remanescentes (explícitos)

1. **Superfície de rotas**: não há prova matemática de que *cada* handler `/api/*` valida `workspaceId`; há amostragem + suíte de integração nas rotas mais sensíveis.
2. **`/api/search`**: ramo vetorial usa `catch {}` e `console.warn` fora do `logger` com scrub — risco P1 de observabilidade e mensagem bruta (ver `docs/SECURITY_REVIEW_P0.md` SEC-04).
3. **UX comercial**: checklist em `docs/COMMERCIAL_UX_P0_AUDIT.md` ainda contém itens ⏳ (jargão, estados vazios globais, etc.); não foram todos fechados nesta rodada.
4. **`AI_REASONING ≠ LEGAL_TRUTH`**: invariante de produto; qualquer regressão em drafting/review exige testes e revisão humana.

## 6. Testes rodados (comandos + resultados)

| Comando | Resultado (2026-05-09) |
|---------|-------------------------|
| `npm run lint` | OK (sem warnings) |
| `npm run typecheck` | OK |
| `npm test` | **534 passed** |
| `npm run test:integration` | **43 passed** (inclui `office-memory.test.ts`) |
| `npm run test:e2e` | **79 passed** (inclui `GET /api/office-memory` → 401 sem cookie) |
| `NODE_ENV=production npm run build` | OK (`/biblioteca/memoria` e rotas API compiladas) |
| `npm run qa:retrieval:domains` | **10/10** domínios OK |
| `npm run db:migrate:deploy` | Migração `20260509220000_office_memory` aplicada no DB configurado em `.env` |

## 7. Falhas encontradas

- Nenhuma falha nos comandos acima após correções finais (typecheck `OfficeMemoryUpdateInput` via `updatedBy: { connect }`).

## 8. Itens adiados (com justificativa)

- **P1 SEC-04** (`/api/search` → logger scrub no vetorial): escopo documentado; correção não misturada nesta entrega para não inflar diff.
- **Exaustão de “toda rota Prisma”**: adiado como processo contínuo; ver tabela em `SECURITY_REVIEW_P0.md`.
- **Refatorar componentes grandes** (`case-facts-tab`, página do caso): adiado (risco/retorno vs sprint).

## 9. Critérios A–N (release) e status item a item

| Critério | Significado | Status |
|----------|-------------|--------|
| **A** | Lint | ✅ `npm run lint` |
| **B** | Typecheck | ✅ `npm run typecheck` |
| **C** | Testes unitários | ✅ `npm test` (534) |
| **D** | Testes integração | ✅ `npm run test:integration` (43) |
| **E** | E2E | ✅ `npm run test:e2e` (79) |
| **F** | Build produção | ✅ `NODE_ENV=production npm run build` |
| **G** | QA retrieval domínios | ✅ `npm run qa:retrieval:domains` (10/10) |
| **H** | Migrações DB aplicáveis | ✅ `db:migrate:deploy` (OfficeMemory) |
| **I** | Multi-tenant / IDOR (regressão nas rotas críticas) | ✅ Testes + APIs novas; não exaustivo |
| **J** | Uploads/exports com `workspaceId` | ✅ Amostragem documentos + exports + relatório segurança |
| **K** | Cache com isolamento por tenant/contexto | ✅ `cache.ts` + desliga com `caseContext` |
| **L** | Logs sem vazamento bruto (política) | ⚠️ `logger` OK; exceção **P1** em `/api/search` |
| **M** | F20 Origem dos dados (UI) | ✅ Fatos, pedidos, riscos, fundamentos fixados |
| **N** | F19 Memória opt-in | ✅ Modelo + API + `/biblioteca/memoria` |

## 10. Status global

**NOT READY**

**Argumentação:** embora **A–K** e **M–N** estejam verdes com evidência de comandos, o critério **L** não está **100%** aderente (P1 em `src/app/api/search/route.ts`). Além disso, o produto comercial ainda carrega débito de UX declarado em `docs/COMMERCIAL_UX_P0_AUDIT.md` (fora desta tabela, mas relevante para “release comercial” honesto). **Não maquiar:** checks verdes não substituem fechamento de P1 de logging nem do backlog de UX.

## 11. Instruções para testar (manual)

1. Abrir o roteiro em **`/test-guide`** (após login), seguir jornadas sentinela.  
2. **F19**: `/biblioteca` → “Memória (opt-in)” → criar entrada WORKSPACE e CASE; alternar RAG/arquivar; em outro workspace (outro membro), confirmar que não vê IDs alheios (404 na API).  
3. **F20**: `/cases/[id]` → abas Fatos / Pedidos / Riscos / Pesquisa jurídica → **Origem** e conferir diálogo.

## 12. Pull Request

- **Branch**: `p0-commercial-sprint-2026-05-09`
- **URL de comparação (após push)**: `https://github.com/tcalgarotto/Lex/compare/main...p0-commercial-sprint-2026-05-09`
- **PR**: criar com `gh pr create` após o commit desta rodada (número do PR preenchido no GitHub após criação).
