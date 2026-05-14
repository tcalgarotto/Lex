# Commercial UX P0 Audit — Lex

> Documento vivo para auditoria de UX comercial P0 do Lex (visão advogado).
> Última atualização: 2026-05-09 (rodada RSC defensivo + UX P1; commits `32abc3b`, `5949777`).

## 1. Objetivo

Garantir que o Lex pareça e funcione como um **produto jurídico comercial** (não demo técnica), com fluxo caso-cêntrico compreensível em < 60s.

## 2. Fluxo alvo (resumo)

Novo caso → relato livre / entrevista guiada → estrutura editável (partes/fatos/pedidos/riscos) → documentos → pesquisa jurídica confiável → estratégia → peça → revisão → export → processo CNJ (se houver).

## 3. P0 (bloqueadores de UX comercial)

Checklist (marcar ✅ apenas com evidência):
- ✅ **Baseline técnica verde (Sprint anterior)**: lint/typecheck/build/e2e/unit/integration verdes; `qa:search:legal` verde. **Fonte**: briefing do usuário + histórico em `docs/UX_FLOW_AUDIT.md` §14.  
- ⏳ **Onde estou?**: cada tela tem título + descrição curta + contexto do caso (quando aplicável).
- ⏳ **Próxima ação**: cada tela/aba tem CTA principal coerente e não “expulsa” o usuário do caso.
- ⏳ **Sem jargão técnico**: usuário não vê “embedding/chunk/qdrant/sparse/dense/intent/grounding”.  
  - **Progresso (P1)**: mapa mínimo em `src/lib/ui/product-terminology.ts` (badge biblioteca, lembrete sobre a base indexada) + rodadas anteriores em busca/peças/pesquisa/timeline/API (ver §8.1); **não** há scrub global nem modo “avançado” só admin.
- ⏳ **Estados vazios** orientam (não “tela fria”).
- ⏳ **Tabs/cards** não quebram em 1366×768.  
  - **Progresso**: `TabsList` do caso com `overflow-x-auto` + `min-w-0` (`case-tabs.tsx`) — smoke manual 1366×768 ainda recomendado para todas as abas.
- ⏳ **Caso vs Processo**: pré-processual é explícito; CNJ só quando existe; Jobs ≠ Processos.
- ✅ **Pesquisa jurídica**: relevância em níveis (Alta/Média/Baixa) + tooltips no painel (`legal-search-panel.tsx`); copy “Adicionar ao caso” alinhada em `/pesquisa-juridica` e botão do painel. **Busca global** `/busca`: escopos em PT-BR e relevância sem % cru (ver §8.1).
- ⏳ **Limitação da base indexada**: UI deixa claro quando base não está disponível (lacuna) e **nunca** vende como fundamento recuperado.  
  - **Progresso**: copy de transparência no estado vazio da pesquisa jurídica + `/test-guide` (`product-terminology.ts`, `legal-search-panel.tsx`, `test-guide/page.tsx`); **não** cobre ainda revisão/minuta/dashboard por completo.
- ✅ **CRUD do caso**: partes/fatos/pedidos/riscos editáveis inline com origem/confidence/status/timeline.  
  - **Evidência (UI)**: `src/components/cases/case-facts-tab.tsx`, `case-parties-tab.tsx`, `case-requests-tab.tsx`, `case-risks-tab.tsx` (+ copy obrigatória em riscos).  
  - **Evidência (API)**: `src/app/api/cases/[id]/{facts,parties,requests,risks}/route.ts` (multi-tenant via `workspaceId` + `caseId`).  
  - **Evidência (timeline)**: cada mutação registra `CaseTimelineEvent(kind=NOTE)`.  
  - **Teste de aceite**: `npm run test:integration -- --run tests/integration/case-structured-crud-routes.test.ts` (4/4) cobre 1 rota por entidade + 404 cross-workspace.

## 4. Telas prioritárias para auditoria

- `/dashboard`
- `/cases`
- `/cases/new`
- `/cases/[id]`
- `/documentos`
- `/pesquisa-juridica`
- `/processos`
- `/test-guide`

## 5. Evidências e achados (preencher)

> Formato exigido por achado:
> - **Problema** (visão do advogado)
> - **Evidência** (rota + arquivo/componente/função; ideal com linhas)
> - **Severidade**: P0/P1/P2
> - **Correção proposta** (mínima; estender módulos existentes, não reescrever)
> - **Agente responsável**
> - **Teste de aceite** (comando e/ou roteiro manual objetivo)

## 5.1 Estado atual (o que já existe)

- **/cases/new já está bem orientado (base boa para comercial)**  
  - **Evidência**: `/cases/new` · `src/app/(app)/cases/new/page.tsx` define 5 modos (`raw/interview/document/existing_process/empty`) e copy explícita “Caso ≠ Processo judicial” + badge “Pré-processual”.

- **/cases/[id] já tem “próximos passos” e CTAs principais no topo**  
  - **Evidência**: `/cases/[id]` · `src/components/cases/case-overview-tab.tsx` monta `steps` (“Enviar primeiro documento…”, “Pesquisar fundamentos…”, “Gerar estratégia…”) e oferece CTAs “Enviar documento” / “Pesquisar fundamentos no caso” / “Gerar estratégia”.

- **Pesquisa jurídica já permite adicionar fundamento ao caso dentro da aba**  
  - **Evidência**: `/cases/[id]` → “Pesquisa jurídica” · `src/components/cases/case-research-tab.tsx` embute `LegalSearchPanel embeddedCaseId` e permite “Adicionar ao caso” sem sair da tela.

## 5.2 Riscos atuais (para UX comercial)

- **Produto “fala como dev” em pontos críticos**: rota `/cases` e alguns labels/termos ainda expõem linguagem interna (ver P0/P1).  
- **Perda de contexto do caso**: alguns links ainda levam para telas “legado/laboratório” (ex.: `/strategy`, `/processos`) em vez de manter ação in-place (ver P0/P1).  
- **Confiança/clareza da base consultada**: mensagens internas podem sugerir “jurisprudência” quando a base principal é legislação (ver P0).

### P0 (bloqueia release)
- **Admin gating server-side insuficiente (risco UX+segurança)**  
  - **Problema**: esconder no menu não impede acesso direto por URL a telas de debug/admin/jobs; produto “vaza” complexidade e abre risco operacional.  
  - **Evidência**: `docs/UX_FLOW_AUDIT.md` §9 aponta “Sidebar gating server-side por MembershipRole” como pendente; `docs/SECURITY_REVIEW_P0.md` checklist 6 inclui “Admin gating server-side” ⏳.  
  - **Severidade**: **P0**  
  - **Correção proposta**: gating **no servidor** (middleware/route handlers/server components) por role/claim; separar “Avançado/Monitoramento” e “Admin/Jobs” com proteção real.  
  - **Agente responsável**: `security-lgpd-multitenant-agent` + `product-ux-legal-workflow-agent`  
  - **Teste de aceite**: e2e (Playwright) tentando acessar URLs avançadas como usuário não-admin deve retornar 404/403; integration test dos handlers protegidos.

- **Risco de “fundamento inventado” quando base não existe (regra absoluta)**  
  - **Problema**: qualquer drafting/review/recommendation que cite CPC/CDC/ECA/LDB/Lei 12.016/jurisprudência como se fosse fundamento recuperado viola `AI_REASONING ≠ LEGAL_TRUTH`.  
  - **Evidência**: regra do briefing; e histórico de risco já tratado no refactor anterior via `getCorpusManifest`/`drafting-guard` (ver `docs/UX_FLOW_AUDIT.md` §14, F4.1).  
  - **Severidade**: **P0**  
  - **Correção proposta**: manter/estender `ApprovedLegalFoundation` + `validateLegalGrounding(result)` + “base ausente” explícita na UI; drafter recebe **somente** `ApprovedLegalFoundation[]`.  
  - **Agente responsável**: `legal-retrieval-qdrant-deepinfra-agent` + `legal-drafting-agent` + `legal-qa-human-review-agent`  
  - **Teste de aceite**: `npm run qa:retrieval:domains` (novo) falha se artigo “aparece” sem estar no corpus; unit tests em `drafting-guard`.

- **/cases exibe jargão e tom “demo técnica” (primeira impressão ruim)**  
  - **Problema**: na listagem de casos, o produto se descreve como automação/pipeline (“Legal Workflow Automation”, “intake/retrieval/drafting/review”), não como ferramenta jurídica. Isso mina confiança comercial nos primeiros 10 segundos.  
  - **Evidência**: `/cases` · `src/app/(app)/cases/page.tsx`:
    - header: “Legal Workflow Automation”
    - descrição: “Pipelines operacionais: intake estruturado, retrieval, drafting e review…”
    - status: `STATUS_LABEL` usa “Intake/Drafting/Review” (inglês)  
  - **Severidade**: **P0**  
  - **Correção proposta**: reescrever copy para linguagem jurídica (“Organize casos, documentos, fundamentos e peças…”) e usar mapeadores PT-BR existentes (`caseStatusLabel`).  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: abrir `/cases` em 1366×768 e confirmar ausência de termos proibidos; status do caso sempre em PT-BR.

- **Dashboard “Próximas ações” manda para `/strategy` (perde contexto do caso)**  
  - **Problema**: o card de pendências é a “bússola do dia”, mas leva para um laboratório/rota avançada em vez de resolver dentro do caso. Advogado se perde e não entende “onde estou”.  
  - **Evidência**: `src/lib/dashboard/next-actions.ts` cria item `cases_needing_strategy` com `href: /strategy?caseId=...` (linha `href` no grupo “Casos com fatos mas sem estratégia”).  
  - **Severidade**: **P0**  
  - **Correção proposta**: linkar para `/cases/[id]` já focando a tab “Estratégia & Peças” (ex.: `?tab=strategy`), mantendo `/strategy` apenas como opção “Avançado”.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `code-review-refactor-agent`  
  - **Teste de aceite**: clicar no item no dashboard e cair no caso correto, com a seção de estratégia visível.

- ✅ **Timeline usava “Pesquisa jurisprudencial” (base errada → quebra confiança)** — **fechado** (`6edf8e8`)  
  - **Problema**: o Lex sugeria “jurisprudência” mesmo quando a base principal é legislação.  
  - **Correção aplicada**: `src/lib/cases/orchestrator.ts` — mensagem neutra `Pesquisa jurídica automática iniciada (acervo indexado)`.  
  - **Teste de aceite**: aba Atividade não exibe mais “jurisprudencial” nesse evento; `npm test` inclui `orchestrator.test.ts`.

- **/busca mostra “vetorial” (jargão) e isso vira badge**  
  - **Problema**: o advogado vê o tipo de resultado como **“vetorial”**, que não comunica valor comercial e parece debug interno.  
  - **Evidência**: `src/app/api/search/route.ts` cria hit com `type: "vetorial"`; a UI renderiza o badge diretamente (sem mapper) em `src/app/(app)/busca/page.tsx`.  
  - **Severidade**: **P0**  
  - **Correção proposta**: mapear tipos por dicionário e nunca renderizar valores crus; trocar por “Trecho de documento” / “Fundamento” ou ocultar no modo comercial.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `legal-retrieval-qdrant-deepinfra-agent`  
  - **Teste de aceite**: abrir `/busca` e pesquisar; **nenhum badge** pode exibir “vetorial” (e2e asserts no `ux-flow.spec.ts`).

- **/busca tem “trecho solto” sem ação de abrir origem (beco sem saída)**  
  - **Problema**: resultados “vetoriais”/trechos não oferecem link para abrir o documento/caso de origem, virando um conteúdo solto e difícil de confiar/usar.  
  - **Evidência**: hits vetoriais no payload não incluem `href`; a UI só navega quando `h.href` existe (`src/app/(app)/busca/page.tsx`).  
  - **Severidade**: **P0**  
  - **Correção proposta**: incluir `documentId`/`caseId` e gerar `href` confiável (ex.: `/documentos/[id]` ou `/cases/[id]?tab=documents`); se não houver origem confiável, **não exibir** no modo comercial.  
  - **Agente responsável**: `legal-retrieval-qdrant-deepinfra-agent` + `library-documents-agent`  
  - **Teste de aceite**: um “Trecho de documento” em `/busca` deve ter CTA “Abrir documento” que navega corretamente.

- **Rotas avançadas sem gating server-side (debug/admin/jobs acessíveis por URL)**  
  - **Problema**: usuário comum consegue acessar por URL superfícies de debug/admin e disparar ações com side-effect, comprometendo UX comercial e elevando risco operacional/LGPD.  
  - **Evidência (histórico)**: antes existia uma rota de diagnóstico `/retrieval/explain` sem gating adequado; **removida**. Permanece revisar `src/app/(app)/settings/jobs/page.tsx` (`triggerCorpusReindexAction` via form) sob perspectiva de role.
  - **Severidade**: **P0**  
  - **Correção proposta**: exigir role/permission no servidor (page-level e handlers/actions) em todas as superfícies admin/jobs/diagnóstico.  
  - **Agente responsável**: `security-lgpd-multitenant-agent` + `code-review-refactor-agent`  
  - **Teste de aceite**: integration/e2e: usuário não-OWNER recebe 403/404 em `/settings/jobs` e não consegue disparar ações com side-effect de corpus sem permissão.

- **Cache de retrieval não inclui `workspaceId`/`caseContext` (risco de poluição/leak)**  
  - **Problema**: retrieval contextual pode incluir sinais do caso (ex.: `problem` do Case Brain) e, se cache não separar por workspace/contexto, vira risco LGPD (poluição cross-tenant) e comportamento incorreto.  
  - **Evidência**: `src/lib/retrieval/legal/cache.ts` key atual não inclui `workspaceId` nem hash de `caseContext`; `/api/retrieval/search` passa `caseContext` quando `caseId` existe; `rewriteLegalQuery` usa `ctx.problem`.  
  - **Severidade**: **P0**  
  - **Correção proposta**: incluir `workspaceId` + hash estável de `caseContext` na cache key **ou** desabilitar cache quando `caseContext`/`mustInclude` estiverem presentes.  
  - **Agente responsável**: `security-lgpd-multitenant-agent` + `legal-retrieval-qdrant-deepinfra-agent`  
  - **Teste de aceite**: integration multi-tenant: duas workspaces com mesma `q` mas contextos distintos não podem compartilhar cache/rewrites/trace.

### P1 (melhorias)
- **Jargão técnico e inconsistência de nomenclatura ainda aparecem em pontos do produto**  
  - **Problema**: termos como “retrieval/grounding/intent/sparse/dense/chunk” afastam advogado e confundem o fluxo.  
  - **Evidência**: `docs/reports/GEMINI_FULL_AUDIT_2026_05_08.md` §6.3 (tabela de termos e locais); `docs/UX_FLOW_AUDIT.md` §9 ainda lista “substituir jargão restante” como pendência.  
  - **Severidade**: **P1**  
  - **Correção proposta**: scrub centralizado (mapa de labels PT-BR) + revisão de copy nos componentes do fluxo principal; modo “avançado” pode expor detalhes apenas para admin/dev.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: snapshot/RTL test que garante ausência de termos proibidos nas rotas primárias; smoke manual em 1366×768.

- **Enum/raw status sem tradução em telas-chave (legibilidade)**  
  - **Problema**: valores crus (`DRAFTING`, `READY`, etc.) geram desconfiança e ruído.  
  - **Evidência**: citado em `docs/reports/GEMINI_FULL_AUDIT_2026_05_08.md` §4 (Missing Translations) e histórico em `docs/UX_FLOW_AUDIT.md` §13 (problemas #12, #13 antes do refactor).  
  - **Severidade**: **P1**  
  - **Correção proposta**: mapeadores PT-BR para enums exibidos; garantir uso consistente em cards/tabs/timeline.  
  - **Agente responsável**: `design-system-frontend-polish-agent`  
  - **Teste de aceite**: unit test das funções `toDisplayLabel(enum)` + verificação em UI principal.

- **Relevância em porcentagem sem explicação (número opaco)**  
  - **Problema**: “87%” parece uma nota/certeza do sistema. Para advogado, deveria ser “relevância” e não um score “científico”.  
  - **Evidência**: `/pesquisa-juridica` · `src/components/legal-search/legal-search-panel.tsx` badge `Math.round(r.score * 100)}%`.  
  - **Severidade**: **P1**  
  - **Correção proposta**: substituir por “Relevância” em níveis (Alta/Média/Baixa) com tooltip curto; evitar % como foco.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: executar uma busca e confirmar que a UI não exibe % cru.

- **Base/tipo de norma aparece como enum cru (`norm.kind`)**  
  - **Problema**: enum técnico reduz polimento comercial e conflita com a narrativa “Constituição/ADCT”.  
  - **Evidência**: `src/components/legal-search/legal-search-panel.tsx` badge `{r.norm.kind}`.  
  - **Severidade**: **P1**  
  - **Correção proposta**: mapear tipo para rótulo jurídico (PT-BR) ou ocultar se redundante.  
  - **Agente responsável**: `design-system-frontend-polish-agent`  
  - **Teste de aceite**: buscar e validar que não há enums crus no card.

- **Detalhe de busca expõe `normUrn`/`provider` (metadado técnico)**  
  - **Problema**: mostrar URN/provider cru deixa o produto com cara de ferramenta interna e não ajuda decisão do advogado.  
  - **Evidência**: `src/app/(app)/busca/page.tsx` exibe `active.normUrn` em `<code>` e `active.provider`.  
  - **Severidade**: **P1**  
  - **Correção proposta**: esconder por padrão; mover para “Detalhes técnicos (avançado)” e manter só “Fonte oficial / referência humana” no modo comercial.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: em `/busca`, abrir detalhe e confirmar ausência de URN/provider na UI padrão.

- **Aba Peças/Drafts ainda expõe termos internos (“chunk”, “retrieval vazio”, “Brain v…”)**  
  - **Problema**: linguagem interna reduz confiança e dificulta treinamento; advogado precisa de referência humana (norma+artigo) e mensagens claras.  
  - **Evidência**: `src/components/cases/case-drafts-tab.tsx` contém texto “provável geração com retrieval vazio”, lista de fontes com prefixo `chunk:` e badge “via Brain v…”.  
  - **Severidade**: **P1**  
  - **Correção proposta**: trocar por PT-BR jurídico (“sem fundamentos consultados”, fontes humanas quando houver; detalhes técnicos só em modo avançado).  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: abrir aba Peças; não aparecer “chunk/retrieval/Brain v” para usuário final.

- **Copy inconsistente: “Usar no caso” vs “Adicionar ao caso”**  
  - **Problema**: duas expressões para a mesma ação geram atrito em treinamento e dúvida (“é a mesma coisa?”).  
  - **Evidência**: `/pesquisa-juridica` header (`src/app/(app)/pesquisa-juridica/page.tsx`) orienta “Usar no caso”; botão real (`src/components/legal-search/legal-search-panel.tsx`) é “Adicionar ao caso” / “No caso”.  
  - **Severidade**: **P1**  
  - **Correção proposta**: padronizar (sugestão: “Adicionar ao caso” em todos os pontos).  
  - **Agente responsável**: `product-ux-legal-workflow-agent`  
  - **Teste de aceite**: conferir consistência em `/pesquisa-juridica` e na aba “Pesquisa jurídica” do caso.

- **CTA de caso pré-processual leva para `/processos` sem contexto do caso**  
  - **Problema**: “Vincular processo existente” tira do caso e não garante retorno; aumenta chance de abandono/erro.  
  - **Evidência**: `/cases/[id]` overview · `src/components/cases/case-overview-tab.tsx` link `href="/processos"` com label “Vincular processo existente”.  
  - **Severidade**: **P1**  
  - **Correção proposta**: modal/flow in-place ou deep-link com `caseId` + CTA claro “Voltar ao caso”.  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: clicar CTA e conseguir vincular sem perder o caso (ou voltar em 1 clique).

#### P1 — fechamento desta rodada (`6edf8e8` + `5949777`)

| Item (§5.2) | Status | Evidência |
|-------------|--------|-----------|
| Jargão / mapa central PT-BR | ⏳ **Parcial** | `src/lib/ui/product-terminology.ts` + consumo em `legal-search-panel.tsx`; demais pontos em busca/peças/pesquisa/API (commits anteriores); **não** há scrub global nem modo “avançado” só admin. |
| Enum cru em cards | ✅ **Fechado** | `/cases` · `caseStatusLabel` já em uso; label **Rascunhos** no lugar de “Drafts” (`src/app/(app)/cases/page.tsx`). |
| Relevância % opaca | ✅ **Fechado** | `/busca` · `buscaRelevanceTier` + `title` com explicação (`src/app/(app)/busca/page.tsx`); painel jurídico já usava Alta/Média/Baixa. |
| `norm.kind` cru | ✅ **Fechado** | `normKindLabel` mapeia enums Prisma (`CONSTITUTION`, `ORDINARY_LAW`, …) em PT (`src/components/legal-search/legal-search-panel.tsx`). |
| URN/provider em detalhe `/busca` | ✅ **N/A / já atendido** | Dialog atual **não** renderiza `normUrn`/`provider` (achado do audit desatualizado). |
| Aba Peças — chunk/retrieval/Brain | ✅ **Fechado** | Lista “Fundamento consultado nº …”; badges já em PT; sem “chunk:” visível ao advogado (`case-drafts-tab.tsx`, `case-research-tab.tsx`). |
| “Usar no caso” vs “Adicionar ao caso” | ✅ **Fechado** | `/pesquisa-juridica`, botão do `LegalSearchPanel`, copy da aba caso. |
| CTA `/processos` sem contexto | ✅ **Fechado** | `?returnCase=<caseId>` + banner “Voltar ao caso” (`processos/page.tsx`, `case-overview-tab.tsx`). |
| `/test-guide` com handler em RSC | ✅ **Fechado** | Botão “Copiar relato” movido para `SentinelJourneysPanel` (client); dados em `lib/test-guide/sentinel-journeys.ts`. |
| Runtime RSC (build não pegou) | ✅ **Mitigação** | Bug produção `/processos` + `onBlur` corrigido em `32abc3b` (`CnjInput`); teste `src/lib/rsc-app-route-handlers-guard.test.ts` falha se `page/layout/not-found/error` **sem** `"use client"` declarar handlers JSX. |

### P2 (polish)
- **Performance percebida na busca global/contextual (latência cold)**  
  - **Problema**: busca global pode parecer lenta se sempre esperar retrieval legal; advogado quer resposta rápida com estados claros.  
  - **Evidência**: `docs/reports/GEMINI_FULL_AUDIT_2026_05_08.md` §5 (Global Search Latency); `docs/reports/CORPUS_HYBRID_SEARCH_UPGRADE.md` mostra cold avg ~3163ms vs warm ~6ms (cache).  
  - **Severidade**: **P2**  
  - **Correção proposta**: UI com streaming/progressive results; cache key já inclui `corpusContentHash` (manter), debounce e paralelização; estados “busca simples” vs “busca contextual”.  
  - **Agente responsável**: `performance-observability-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: medição automatizada (script) cold/warm + thresholds; UX: skeleton e partial rendering.

- **Vocabulário “pin/pinar/pinada(s)” em PT-BR (pouco natural)**  
  - **Problema**: “pinar” é jargão emprestado; em produto jurídico comercial tende a soar técnico.  
  - **Evidência**: `src/components/legal-search/legal-search-panel.tsx` (erro “pinar fundamento”); `src/components/cases/case-drafts-tab.tsx` badge “{N} pinada(s)”.  
  - **Severidade**: **P2**  
  - **Correção proposta**: substituir por “salvar fundamento no caso” / “salvo(s) no caso)”.  
  - **Agente responsável**: `product-ux-legal-workflow-agent`  
  - **Teste de aceite**: pinar/salvar fundamento e gerar peça; checar badges e mensagens.

- **Badge “blocker” aparece em inglês na entrevista guiada**  
  - **Problema**: “blocker” é vocabulário de engenharia; advogado entende melhor “crítico/obrigatório/impede peça”.  
  - **Evidência**: `/cases/[id]` → “Entrevista guiada” · `src/components/cases/case-checklist-tab.tsx` badge literal `blocker`.  
  - **Severidade**: **P2**  
  - **Correção proposta**: trocar por “crítico” (tooltip “impede gerar peça sem lacunas”).  
  - **Agente responsável**: `product-ux-legal-workflow-agent` + `design-system-frontend-polish-agent`  
  - **Teste de aceite**: abrir checklist com campos críticos e confirmar que não aparece “blocker”.

- **Try/catch silencioso em busca global (suporte/QA fica cego)**  
  - **Problema**: falhas do vetor/retrieval ficam invisíveis, virando “resultados inconsistentes” sem rastreabilidade.  
  - **Evidência**: `src/app/api/search/route.ts` tem `catch {}` no bloco vetorial.  
  - **Severidade**: **P2**  
  - **Correção proposta**: logar com scrub (sem PII) via logger e/ou expor um campo debug só para admin; modo comercial não deve mostrar erro técnico.  
  - **Agente responsável**: `performance-observability-agent`  
  - **Teste de aceite**: simular falha de Qdrant e verificar log/warn controlado; busca não quebra.

- **Defesa em profundidade: `update({ where: { id } })` após `findFirst({ id, workspaceId })`**  
  - **Problema**: padrão frágil (seguro no fluxo atual, mas aumenta risco de regressão de tenancy em futuras mudanças).  
  - **Evidência**: exemplo em `src/app/api/pieces/[id]/route.ts` (busca com workspaceId e update por id puro).  
  - **Severidade**: **P2**  
  - **Correção proposta**: usar `updateMany({ where: { id, workspaceId }, data })` e validar `count===1`.  
  - **Agente responsável**: `security-lgpd-multitenant-agent` + `code-review-refactor-agent`  
  - **Teste de aceite**: integration test impede update de peça de outro workspace.

## 6. Como testar (roteiro manual)

Usar o roteiro em `docs/UX_FLOW_AUDIT.md` e registrar aqui quaisquer becos sem saída.

## 7. Comandos / evidência desta rodada

> Preencher somente quando rodar nesta sprint (não inventar).

- ✅ `npm run lint` (OK)
- ✅ `npm run typecheck` (OK)
- ✅ `npm run test:integration -- --run tests/integration/case-structured-crud-routes.test.ts` (4/4 OK)
- ✅ `npx prisma migrate deploy` (OK; aplicou `20260509132000_casefact_metadata_json`)
- ⚠️ `npx prisma migrate dev --create-only --name add_case_fact_metadata` (FALHOU por drift; ver log no terminal)
- ✅ Fechamento sprint (2026-05-09): `npm run lint`, `npm run typecheck`, `npm test` (534), `npm run test:integration` (43), `npm run test:e2e` (80), `NODE_ENV=production npm run build`, `npm run qa:retrieval:domains` (10/10) — todos OK no ambiente do agente.
- ✅ **Rodada UX P1 (pós-READY, mesmo dia)**: `npm run lint`, `npm run typecheck`, `npm test` (534), `npm run test:integration` (43), `npm run test:e2e` (80), `NODE_ENV=production npm run build` — OK após alterações de copy/UX em `6edf8e8`.
- ✅ **Rodada RSC + UX (pós-READY)**: `npm run lint`, `npm run typecheck`, `npm test` (**535** com `rsc-app-route-handlers-guard.test.ts`), `npm run test:integration` (43), `npm run test:e2e` (80), `NODE_ENV=production npm run build`, `npm run qa:retrieval:domains` (10/10) — OK após `32abc3b` + `5949777`.

## 8. P1 — status (atualizado pós-gate A–N)

### 8.1 Fechamento da lista P1 (copy, fluxo, labels)

- Tabela e evidências em **§5.2 “P1 — fechamento desta rodada”** (`6edf8e8`, `32abc3b`, `5949777`).
- **Gate A–N**: **não reaberto**; alterações são só camada de produto (strings, labels, deep-link, mapeamento de enums na UI).
- **Pendência explícita**: checklist amplo §3 (tabs em 1366×768, “onde estou” em **todas** as telas, estados vazios globais, limitação da base indexada em toda superfície) continua **dívida** — ver itens ⏳ em §3; próxima rodada pode usar `design-system-frontend-polish-agent` com screenshots.

### 8.2 Gate de segurança / observabilidade (critério L)

- **Fechado** na sprint anterior. Detalhes: `docs/SECURITY_REVIEW_P0.md` e `docs/CODE_REVIEW_P0.md` §5.

