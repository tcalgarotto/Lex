# Code Review P0 — Lex

> Checklist de code review focado em riscos P0 (produto jurídico + multi-tenant + RAG seguro).
> Última atualização: 2026-05-09.

## 1. Objetivo

Impedir regressões críticas em:
- multi-tenant / workspace scoping
- IDOR
- RAG grounding (fonte citável)
- placeholders mascarados em minuta
- export/download/segurança

## 2. Checklist P0 (bloqueia merge)

- ⏳ **Tenancy (Prisma)**: toda query por ID valida `workspaceId` (direto ou via join).
- ⏳ **Tenancy (Qdrant)**: `lex_main` sempre com filtro `workspaceId`; corpus oficial nunca mistura workspace.
- ⏳ **Cache**: chaves incluem `workspaceId` para dados privados.
- ⏳ **Admin gating**: rotas admin/jobs/debug protegidas server-side (não só menu).
- ⏳ **Logs**: scrub ativo; nada de texto cru de relato/documento/chunks.
- ⏳ **Uploads**: valida tipo/tamanho; path traversal bloqueado.
- ⏳ **Downloads/Exports**: valida ownership/tenancy; não inclui anexos de outro workspace.
- ⏳ **Drafting**: só usa `ApprovedLegalFoundation[]`/pinned; lacunas explícitas; sem CPC/CDC/CC/ECA/LDB/Lei MS se não indexado.
- ⏳ **Review**: reprova placeholders mascarados e ausência de grounding.
- ⏳ **UX**: sem jargão técnico no fluxo do advogado.

## 3. Evidências exigidas

- testes novos/atualizados cobrindo o bug/feature
- comandos rodados local/CI (quando aplicável): lint, typecheck, test, build

**Evidência desta rodada (rodado local):**
- ✅ `npm run lint`
- ✅ `npm run typecheck`
- ✅ `npm test`
- ✅ `npm run test:integration`
- ✅ `NODE_ENV=production npm run build`
- ✅ `npm run qa:retrieval:domains`

## 4. Relatório de revisão (preencher com evidência)

> Não declarar “revisado” sem evidência (diff + testes quando aplicável).

### 4.1 Arquivos revisados

- (preencher)

### 4.2 Problemas críticos (P0)

- ✅ **Admin gating server-side (rotas avançadas por URL)**  
  - **Evidência**: `src/app/api/retrieval/explain/route.ts`, `src/app/(app)/retrieval/explain/page.tsx`, `src/app/(app)/settings/jobs/page.tsx`, `src/app/(app)/processos/actions.ts` (actions sensíveis).  
  - **Teste de aceite**: (pendente) e2e/integration: não-OWNER retorna 403/404.

- ✅ **Cache contextual protegido** (evita compartilhamento quando há `caseContext`)  
  - **Evidência**: `src/lib/retrieval/legal/index.ts` desativa cache quando `opts.caseContext` está presente.  
  - **Teste de aceite**: (pendente) integration multi-tenant com contextos diferentes.

- **Busca global: tipo “vetorial” e hits sem `href` (UX comercial + maintainability)**  
  - **Evidência**: `src/app/api/search/route.ts` + `src/app/(app)/busca/page.tsx`.  
  - **Risco**: jargão em UI e “trecho solto” sem origem; difícil de suportar/explicar.  
  - **Correção proposta**: modelar hit com origem (`documentId/caseId/href`) e mapper de labels.  
  - **Teste de aceite**: e2e `/busca` não mostra jargão e permite abrir origem.

### 4.3 Problemas médios (P1)

- **UI exibindo identificadores técnicos (URN/provider/enums crus)**  
  - **Evidência**: `src/app/(app)/busca/page.tsx`, `src/components/legal-search/legal-search-panel.tsx`, `src/components/cases/case-drafts-tab.tsx`.  
  - **Correção proposta**: mapeadores PT-BR + “Detalhes técnicos (avançado)”.

### 4.4 Sugestões (P2)

- **Defesa em profundidade: atualizar por `id` após buscar por `{ id, workspaceId }`**  
  - **Evidência**: exemplo em `src/app/api/pieces/[id]/route.ts`.  
  - **Correção proposta**: `updateMany({ where: { id, workspaceId }, ... })` com `count===1`.

- **Try/catch silencioso em busca global**  
  - **Evidência**: `src/app/api/search/route.ts` com `catch {}`.  
  - **Correção proposta**: log com scrub + requestId; manter degrade gracioso.

### 4.5 Pendências / itens adiados

- **Tenancy/IDOR**: varredura por evidência nas rotas de upload/download/export (docs/peças) ainda pendente (precisa testes e/ou review por diff).
- **Drafting guard**: migrar drafting para consumir apenas `ApprovedLegalFoundation[]` (F7.2) ainda pendente.
- **Search performance**: otimizações de latência/cache com chave por `workspaceId+brainVersion+corpusContentHash` (F22) ainda pendente.

