# UX Flow Audit — Lex (Caso-centric)

> Documento vivo da auditoria UX do Lex. Última revisão: **2026-05-09 — P0 + P1 + P2 + Hotfix Gemini + QA Manual Creche (F0 do Case Brain Refactor)**.

## 1. Diagnóstico

O Lex acumulou módulos técnicos avançados (RAG nacional, ingest pipeline, integrações com tribunais, cockpit, retrieval explicável, editor de peças, cases workflow), mas a UX estava fragmentada:

- 31 rotas funcionais com nomenclatura técnica (`/retrieval`, `/cockpit`, `/biblioteca`, `/strategy`, `/jobs`).
- Nenhum **objeto central** unificando a jornada — `Process`, `Document`, `Case`, `LegalPiece`, `LegalNorm` viviam em silos.
- Documentos travados em `PARSING`/`CHUNKING`/`EMBEDDING` apareciam como "em processamento" indefinidamente.
- Buscas globais retornavam vazio sem feedback (4 estados ausentes).
- Sidebar misturava operação real (Casos) com debug interno (Retrieval, Jobs IA).
- O usuário advogado não tinha um caminho claro: "criar caso → enviar documentos → pesquisar direito → gerar estratégia → gerar peça".

**Decisão estrutural:** o objeto **`Caso`** vira o centro da experiência, sem migração destrutiva e sem quebrar `/processos` legado.

## 2. Rotas mapeadas (antes × depois)

| Categoria | Antes | Depois |
| --- | --- | --- |
| **Centro da jornada** | `/processos` (técnico, primeiro item) | `/cases` (primeiro item) · `/cases/[id]` em 6 abas |
| **Documentos do escritório** | espalhados em `/processos/[id]/documentos` | `/documentos` (lista única) + integração no caso |
| **Pesquisa jurídica** | `/biblioteca` (catálogo bruto) + `/retrieval` (debug) | `/pesquisa-juridica` (UI amigável) |
| **Peças** | `/editor/[id]` direto | `/editor` (índice) → `/editor/[id]` |
| **Busca global** | `/busca` retornando array vazio | `/busca` agregada (Workspace + Legal) com 4 estados |
| **Legado preservado** | — | `/processos`, `/strategy`, `/cockpit`, `/retrieval/explain` continuam funcionais (em "Avançado") |
| **Redirects** | — | `/biblioteca` → `/pesquisa-juridica?scope=legislacao` · `/retrieval` → `/pesquisa-juridica` |

## 3. Problemas identificados (12)

1. `/biblioteca` confundia legislação oficial com documentos do usuário.
2. Nenhuma rota explícita para "documentos do escritório".
3. Documentos travados não eram detectáveis pela UI.
4. Reprocesso podia teoricamente apagar pontos do corpus oficial (Qdrant).
5. `Case` não tinha vínculo com `Process` legado nem com `Document`.
6. `/cases/[id]` tinha 11 abas técnicas (drift de escopo).
7. `/busca` retornava vazio silenciosamente.
8. Sidebar misturava ferramentas de admin/dev com produto.
9. Dashboard sem "próximas ações" — só mostrava métricas técnicas.
10. Upload exigia passar por `/processos` mesmo quando o usuário já estava no contexto de caso.
11. Pesquisa jurídica sem forma de "pinar" um fundamento ao caso.
12. Sem `not-found` específico do app — usuário caía em página crua.

## 4. Decisões tomadas

| Decisão | Motivo |
| --- | --- |
| `Case.processId? @unique` (1:1 opcional) | Ponte leve com `Process`, sem migração destrutiva. |
| `Document.caseId?` + `@@index([caseId])` | Vínculo opcional sem quebrar `Process.documents`. |
| Nova tabela `CaseLegalSource` | Persiste fundamentos pinados em pesquisa do caso. |
| `/biblioteca` → redirect | Catálogo bruto não é caminho do usuário. |
| `/cases/[id]` em **6 abas** (não 11) | Escopo enxuto; tabs internas reagrupadas. |
| Status `Travado` derivado em runtime | Sem alterar enum `DocumentStatus` em prod. |
| Reprocess Qdrant com filtro **estrito** (`lex_main` + `documentId` + `workspaceId`) | Garantia: nunca tocar `lex_corpus_norms`. |
| OCR desligado em `NODE_ENV=test` | Testes determinísticos sem depender de `.env` local. |
| `npm run build` chama `clean` antes | Resolve bug do Next 15.3 com `output:standalone` em builds incrementais sujos. |

## 5. Novo menu (Sidebar)

### Primário
1. **Início** (`/dashboard`)
2. **Casos** (`/cases`)
3. **Documentos** (`/documentos`)
4. **Pesquisa jurídica** (`/pesquisa-juridica`)
5. **Peças** (`/editor`)
6. **Processamentos** (`/processos`)
7. **Equipe** (`/settings/team`)
8. **Configurações** (`/settings/perfil`)

### Avançado (colapsável)
- Cockpit operacional (`/cockpit`)
- Laboratório de estratégia (`/strategy`)
- Retrieval (debug) (`/retrieval/explain`)
- Jobs IA (`/settings/jobs`)
- Roteiros de entrevista (`/settings/roteiros`)
- Administração (`/settings/admin`)
- Guia de teste (`/test-guide`)

## 6. Novo fluxo

```mermaid
flowchart LR
  Init[Início] --> Cases[Casos]
  Cases --> CaseId[Caso X]
  Docs[Documentos] -. vincular .-> CaseId
  CaseId --> CaseDocs[Aba Documentos]
  CaseId --> CaseFatos[Aba Fatos & Partes]
  CaseId --> CaseResearch[Aba Pesquisa jurídica]
  CaseResearch -. usar no caso .-> Pinned[CaseLegalSource]
  CaseId --> CaseEst[Aba Estratégia & Peças]
  CaseEst --> Editor[/editor/pieceId]
  Init -. próximas ações .-> Travados[Documentos travados]
  Init -. próximas ações .-> SemCase[Documentos sem caso]
  Init -. próximas ações .-> SemEstrategia[Casos sem estratégia]
```

**Jornada-tipo do advogado:**

1. Vai em **Casos**, cria ou abre um caso.
2. Em **Documentos** do caso, envia uma petição ou contrato (ou vincula um doc já no escritório).
3. Acompanha o processamento (status display em PT-BR; alerta "Travado" se passar do threshold).
4. Em **Fatos & Partes**, vê o intake estruturado (extraído via `intake.ts`, sem LLM no caminho crítico).
5. Em **Pesquisa jurídica** do caso, busca legislação (CF, ADCT) e clica em **"Usar no caso"** para pinar fundamentos.
6. Em **Estratégia & Peças**, dispara `/api/strategy/analyze` (já existente, aceita `caseId`) e gera minuta `LegalPiece`.
7. Em **Atividade**, audita timeline (`CaseTimelineEvent`).

## 7. Correções e entregas

### P0 — Estabilizar a jornada mínima (9/9 ✅)
- `/biblioteca` → redirect.
- Migration `add_case_relations` (não destrutiva).
- `deriveDocumentDisplayStatus` + `findStalledDocuments`.
- Reprocess Qdrant com filtro estrito.
- `/cases/[id]` em 6 abas.
- `/documentos` (lista do workspace).
- `/api/documents/[id]/link-case` (POST).
- `/pesquisa-juridica` + `/api/retrieval/search` + `LegalSearchPanel`.
- `/busca` com 4 estados (loading · empty · no-results · error).

### P1 — Polish da jornada (5/5 ✅)
- Sidebar refatorada (Primary + Avançado colapsável).
- `/retrieval` → redirect para `/pesquisa-juridica` (`/retrieval/explain` continua admin).
- Dashboard "Próximas ações" (6 categorias).
- `/api/documents/upload` aceita `caseId`. `DocumentUploadButton` reutilizável.
- `/api/cases/[id]/legal-sources` (POST/GET/DELETE).

### P2 — Documentação e robustez (concluído)
- `EmptyState` componente em `src/components/ui/empty-state.tsx` aplicado em `/cases`, `/documentos`, `/editor`, `/pesquisa-juridica` e nas tabs vazias do caso.
- `(app)/not-found.tsx` com atalhos para Casos, Documentos e Pesquisa.
- Este `UX_FLOW_AUDIT.md` (11 seções) + atualização do README com fluxo caso-cêntrico.
- `tests/e2e/ux-flow.spec.ts` cobrindo as rotas principais sem auth.

### Hotfix Gemini (auditoria 2026-05-08)
- `extract-text.ts` desliga OCR em `NODE_ENV=test`/`VITEST=true`.
- `package.json` ganha `clean` + `build` defensivo.
- `.gitignore` para `*.traineddata` e `.cursor/plans/`.

## 8. Redirects

| De | Para | Tipo |
| --- | --- | --- |
| `/biblioteca` | `/pesquisa-juridica?scope=legislacao` | `redirect()` Server |
| `/retrieval` | `/pesquisa-juridica` | `redirect()` Server |

`/processos`, `/strategy`, `/cockpit`, `/retrieval/explain` permanecem **funcionais** (acessados via menu Avançado ou URL direta).

## 9. Pendências e dívida técnica

| Item | Severidade | Notas |
| --- | --- | --- |
| Substituir jargão restante (Retrieval/Grounding/Sparse/Dense/Intent/Cockpit/Pinado) | P2 | Audit Gemini sec. 6.3. |
| Mapeadores PT-BR para enums (`NormKind`, `CaseStatus`, `IntegrationStatus`, `DocumentStatus`) | P2 | Pendente. |
| Sincronizar rótulo da sidebar com título de página em `/processos` | P3 | Inconsistência menor. |
| `workspaceId` direto em `CaseLegalSource` | P2 | Defesa em profundidade; hoje é via `case.workspaceId`. |
| Otimizar `/api/search` (debounce/paralelização) | P2 | ~3s perceptível. |
| `Document.caseId` sem `onDelete: Cascade` | P3 | Apontado no audit. Aceitável (preserva docs órfãos). |
| Sidebar gating server-side por `MembershipRole` | P3 | Hoje é só visual; itens "dev" continuam acessíveis por URL. |
| `src/lib/navigation.ts` dedicado | P3 | Hoje config inline em `app-sidebar.tsx`. |

## 10. Riscos técnicos

- **Migration em prod**: aplicada com `prisma migrate deploy` em Supabase. `Document` pode ter volume; índice criado em background suportado pelo Postgres.
- **Reprocess Qdrant**: usa `documentId` indexado em `lex_main`. Verificar antes de cada deploy.
- **`/api/search` performance**: `retrieveLegalContext` adiciona ~3s cold (warm 6ms). Cache LRU + Redis já implementado (chave inclui `corpusContentHash`).
- **`CaseLegalSource`**: cascade delete + workspace scoping (validado via `case.workspaceId` no endpoint).
- **OCR opcional**: produção mantém `OCR_PROVIDER=tesseract` opcional; tests sempre com OCR desligado.
- **Build Next 15.3**: bug com `output:standalone` em builds incrementais mitigado pelo `clean` no `npm run build`.

## 11. Como testar

### Automação
```bash
npm run lint                       # ESLint clean
npm run typecheck                  # tsc --noEmit
OCR_PROVIDER=tesseract npm test    # 482/482 (66 files)
npm run test:integration           # 25/25 (4 files)
NODE_ENV=production npm run build  # build clean, 500.html no destino
npm run test:e2e -- tests/e2e/02-auth-redirects.spec.ts  # 13/13
npm run test:e2e -- tests/e2e/ux-flow.spec.ts            # cobre rotas centrais
npm run qa:search:legal            # 15/15 QA jurídico
```

### QA manual (smoke da jornada caso-cêntrica)

1. Login.
2. **Casos** → criar caso novo.
3. **Aba Documentos** → enviar PDF de petição. Acompanhar status (Enviado → Extraindo texto → ... → Pronto para busca).
4. Se travar 15+ min → status muda para "Travado". Botão "Reprocessar" funciona.
5. **Aba Fatos & Partes** → ver intake estruturado.
6. **Aba Pesquisa jurídica** → buscar "devido processo legal". Clicar em "Usar no caso" no resultado relevante.
7. Voltar à aba — fundamento pinado aparece.
8. **Aba Estratégia & Peças** → checklist mostra próximos passos. Gerar minuta.
9. **Aba Atividade** → eventos no timeline.
10. **`/documentos`** → todos os documentos do workspace listados; filtro "Sem caso" funciona.
11. **`/pesquisa-juridica`** → pesquisar sem caseId; sem botão "Usar no caso" (esperado).
12. **`/biblioteca`** → redireciona para `/pesquisa-juridica?scope=legislacao`.
13. **`/retrieval`** → redireciona para `/pesquisa-juridica`.
14. **`/foo-bar-inexistente`** dentro do app → exibe `(app)/not-found.tsx` com atalhos.

## 12. Status final (release readiness)

- **P0 + P1 + P2:** entregues e validados.
- **Hotfix Gemini:** aplicado.
- **Suite automatizada:** verde (lint, typecheck, unit, integration, build, e2e auth-redirects + ux-flow).
- **QA manual:** roteiro acima documentado para execução pelo time.

**Release ready: SIM**, condicionado à execução do QA manual no ambiente de staging.

## 13. QA manual — inconsistências encontradas em caso real (creche Camboriú)

> Simulação de atendimento jurídico pré-processual feita após P0+P1+P2 entregues. Cliente fictícia: **Ana Paula da Silva**, mãe de Lara (4 anos), Camboriú/SC, sem vaga em creche municipal. Objetivo: gerar peça (Mandado de Segurança ou ação de obrigação de fazer). O QA encontrou **18 inconsistências** entre UX e inteligência jurídica, descritas abaixo com evidência por arquivo:linha, severidade e fase de correção do **Lex Case Brain Refactor**.

### Tabela de problemas

| # | Problema | Evidência (arquivo:linha) | Severidade | Fase |
| --- | --- | --- | --- | --- |
| 1 | `CaseLegalSource` (fundamentos pinados) **nunca entra na minuta**: `draftWorkflow` constrói query a partir de `summary + facts + requests` e ignora `case.legalSources`. | [`src/lib/cases/orchestrator.ts:71-77`](../src/lib/cases/orchestrator.ts) | P0 | F4 |
| 2 | `isLikelyRequest` usa `lower.includes("requer")` → "A **requerida** não compareceu" vira pedido. Causa raiz de "fato virou pedido". | [`src/lib/cases/intake.ts:218-221`](../src/lib/cases/intake.ts) | P0 | F2 (intake) |
| 3 | `renderLaw` consome top-12 do retrieval sem filtro contextual. Como corpus é só CF/ADCT, qualquer query distante puxa **ADCT Art. 95** como fundamento. | [`src/lib/cases/drafting.ts:139-178`](../src/lib/cases/drafting.ts) | P0 | F4 |
| 4 | `runReview` só checa cabeçalhos `## I.`-`## V.`, ignora `_Partes a qualificar._`, `[Juízo competente]`, `R$ ____`. Aprova peça vazia com **score 1.00**. | [`src/lib/cases/review.ts:74-99`](../src/lib/cases/review.ts) | P0 | F6 |
| 5 | `CaseParty.document` (CPF/CNPJ) renderizado em texto puro, sem máscara nem toggle. | [`src/components/cases/case-parties-tab.tsx:35-38`](../src/components/cases/case-parties-tab.tsx) | P1 | F1 |
| 6 | CTAs "Pesquisar fundamentos" e "Gerar estratégia" no Overview tiram usuário do caso (linkam `/pesquisa-juridica` e `/strategy`). Mesma coisa com "Atualizar estratégia" em Strategy & Peças. | [`case-overview-tab.tsx:218-229`](../src/components/cases/case-overview-tab.tsx) · [`case-strategy-pieces-tab.tsx:68-73`](../src/components/cases/case-strategy-pieces-tab.tsx) | P0 | F1 |
| 7 | Pin não atualiza lista de "Fundamentos do caso" sem reload manual: `legal-search-panel.tsx` faz POST + `setState` local mas não chama `router.refresh()` (unpin chama). | [`src/components/legal-search/legal-search-panel.tsx:98-123`](../src/components/legal-search/legal-search-panel.tsx) | P1 | F1 |
| 8 | Não existe `DELETE /api/documents/[id]` — só `GET`. Documento errado fica preso no caso. | [`src/app/api/documents/[documentId]/route.ts:5-54`](../src/app/api/documents/[documentId]/route.ts) | P0 | F1 |
| 9 | Chunker v2 produz 1 chunk por artigo. Art. 5º (gigante, ~5KB) vira chunk único; inciso/§ entram como buffer no acumulador (último visto sobrescreve refs). Boost de inciso nunca aplica. | [`src/lib/corpus/legal-chunker-v2.ts:187-240`](../src/lib/corpus/legal-chunker-v2.ts) | P1 | F3.5 |
| 10 | `articleRef` no intent vem como `Art. 5` (sem `º`), mas chunks têm `Art. 5º`. Boost 1.15 nunca aplica → ranking degradado para qualquer query com número de artigo. | [`intent.ts:113-116`](../src/lib/retrieval/legal/intent.ts) · [`cf-semantic-parser.ts:146-150`](../src/lib/corpus/providers/cf-semantic-parser.ts) | P1 | F3 |
| 11 | `/api/retrieval/search` aceita `caseId` mas só ecoa — não usa para contextualizar query nem filtrar resultados. | [`src/app/api/retrieval/search/route.ts:62-71`](../src/app/api/retrieval/search/route.ts) | P1 | F3 |
| 12 | Status enum (`DRAFTING`, `READY`, `INDEXED`) exibido raw em `case-drafts-tab` e header da página. | [`case-drafts-tab.tsx:18-47`](../src/components/cases/case-drafts-tab.tsx) · [`page.tsx:14-23`](../src/app/(app)/cases/[id]/page.tsx) | P1 | F1 |
| 13 | Header da página de caso fala literalmente em "retrieval, drafting, review" e "chunks normativos". Timeline mostra `retrieval: {N} chunks`. | [`page.tsx:74-77`](../src/app/(app)/cases/[id]/page.tsx) · [`case-timeline-tab.tsx:54-57`](../src/components/cases/case-timeline-tab.tsx) | P1 | F1 |
| 14 | Não existe **Case Brain**: caso não tem narrativa, área, autoridade provável, problema jurídico, objetivo extraídos. Cada workflow rebusca informação do zero. | n/a (ausência) | P0 | F2 |
| 15 | `renderUrgency` cita `art. 300 CPC` e `art. 7º Lei 12.016/2009` hard-coded mesmo quando o corpus não tem essas normas → peça simula citar fonte que não foi consultada. | [`src/lib/cases/drafting.ts:213-218`](../src/lib/cases/drafting.ts) | P0 | F4.1 |
| 16 | Não existe **Document-Case Consistency Checker**: documento de outro cliente vinculado ao caso passa silenciosamente. | n/a (ausência) | P1 | F4.5 |
| 17 | `case-drafts-tab` mostra markdown como `<pre>` ou texto bruto; **sem preview formatado, sem editor, sem salvar versão**. Advogado precisa baixar e reescrever fora do sistema. | [`case-drafts-tab.tsx`](../src/components/cases/case-drafts-tab.tsx) | P0 | F5 |
| 18 | `/cases/new` exige relato narrativo único; sem opção de "entrevista guiada", "enviar documento", "processo existente" ou "caso vazio". Cliente raramente chega com relato estruturado. | [`src/app/(app)/cases/new/page.tsx:33-37`](../src/app/(app)/cases/new/page.tsx) | P0 | F1.5 + F2.1 |

### Roteiro do QA simulado

1. Criei caso novo com texto **incompleto** (estilo cliente real): "Dra., minha filha Lara está sem creche. Eu fui na prefeitura e mandaram esperar."
2. Sistema criou caso com título genérico e nenhuma parte. Tab Fatos & Partes mostrou apenas a frase como "fato".
3. Tentei pesquisar "vaga em creche" — top-3 retornou Art. 81 e Art. 56 do ADCT como principais. Art. 208 IV (educação infantil em creche) ficou no top-7.
4. Pinei manualmente Art. 208 IV e Art. 205. CTA da pesquisa me jogou para `/pesquisa-juridica?caseId=...` (saí do caso).
5. Voltei para o caso. Pinned não apareceu até dar reload.
6. Cliquei em "Gerar minuta". Resultado:
   - Endereçamento `[Juízo competente]`.
   - Partes: `_Partes a qualificar._` (sem Ana Paula nem Lara, mesmo com nomes no relato).
   - Fundamentação: ADCT Art. 95 (irrelevante) + outros chunks aleatórios. Art. 208 IV (pinned) ausente.
   - Pedido cominatório com `R$ ____`.
   - `renderUrgency` citou "art. 300 do CPC" — mas corpus não tem CPC.
7. Cliquei em "Rodar review". Resultado: **score 1.00 — Pronta para protocolo**. Critério de placeholder não existe.
8. Sem opção de editar a minuta dentro do sistema. Sem prontidão processual visível. Sem checklist guiando o que faltava perguntar à cliente.

### Complementos pós-simulação de atendimento real

A simulação revelou **4 lacunas estruturais** que vão além da lista dos 18 problemas técnicos. Ficam mapeadas como complementos obrigatórios do Case Brain Refactor:

1. **Cliente não relata caso de forma estruturada.** Sistema precisa de **checklist guiado** ("Constitucional — vaga em creche" como primeiro template) que ajude o advogado a transformar relato incompleto em estrutura jurídica utilizável. → **F2.1**.
2. **Necessidade de prontidão processual.** Painel do caso precisa mostrar "Prontidão processual: NN%" com `blockers`, `missingDocuments`, `nextBestAction`. Botão "Gerar peça" bloqueado em `insuficiente`. → **F2.2**.
3. **Risco de citar normas fora do RAG.** Drafting v2 precisa de **`getCorpusManifest()`** + **`assertCitationAllowed()`** para nunca citar CPC/ECA/LDB/Lei 12.016/CDC/CC ou jurisprudência como fonte recuperada enquanto não estão no corpus. Esses fundamentos viram bloco "VII. Lacunas de complementação". → **F4.1**.
4. **Distinção entre caso pré-processual e processo judicial.** `/cases/new` precisa de 5 modos (relato livre · entrevista guiada · enviar documento · processo existente · caso vazio). Campos CNJ/vara/tribunal só em "processo existente" ou "marcado como protocolado". Painel mostra badge "Pré-processual — ainda sem número CNJ" quando aplicável. → **F1.5**.

### Mapeamento problema → fase

| Fase | Problemas endereçados |
| --- | --- |
| F0 | Esta seção (governança/auditoria) |
| F1 | #5 (PII), #6 (CTAs), #7 (pin instantâneo), #8 (DELETE doc), #12 (status PT-BR), #13 (jargão técnico) |
| F1.5 | #18 (5 modos no Novo Caso) + complemento 4 (Caso ≠ Processo) |
| F2 | #2 (intake `\b...\b`), #14 (Case Brain LLM-first auditável) |
| F2.1 | complemento 1 (checklist guiado) |
| F2.2 | complemento 2 (prontidão processual) |
| F3 | #10 (articleRef normalize), #11 (caseId no retrieval) |
| F3.5 | #9 (re-chunk controlado) |
| F4 | #1 (pinned na minuta), #3 (filtro contextual), #15 (renderUrgency condicional) |
| F4.1 | complemento 3 (RAG Limitation Guard) — também reforça #15 |
| F4.5 | #16 (Consistency Checker) |
| F5 | #17 (preview/edit/save) |
| F6 | #4 (review detecta placeholders) |
| F7 | testes + docs (CASE_BRAIN.md, DRAFTING_REVIEW_FLOW.md) |

## 14. Status final do Lex Case Brain Refactor

> Fechamento da auditoria após execução completa de F0..F7.

| Fase | Status | Notas |
| --- | --- | --- |
| F0 — auditoria QA creche | ✅ entregue | Esta seção (governança) + 18 problemas mapeados. |
| F1 — UX dentro do caso | ✅ entregue | PII mascarada, CTAs in-place, pin instantâneo, DELETE doc, jargão removido. |
| F1.5 — Caso × Processo | ✅ entregue | `/cases/new` com 5 modos. Status `Pré-processual` visível. |
| F2 — Case Brain v1 | ✅ entregue | LLM-first auditável, cache por inputHash, Inngest hooks. |
| F2.1 — Entrevista guiada | ✅ entregue | Registry de checklists, primeiro template (creche). |
| F2.2 — Prontidão processual | ✅ entregue | `ReadinessCard` + bloqueio do botão "Gerar peça". |
| F3 — Pesquisa contextual | ✅ entregue | `articleRef` normalize, snippet, query expansion via brain. |
| F3.5 — Re-chunk controlado | ✅ entregue | Chunker v3 inciso/§-aware + `parentChunkId`. |
| F4 — Drafting v2 | ✅ entregue | `buildCaseContext`, `mustInclude`, ADCT filter, header escolhe rito. |
| F4.1 — RAG Limitation Guard | ✅ entregue | `getCorpusManifest`, `decideCitationSync`, "Bases não disponíveis" na UI. |
| F4.5 — Consistency Checker | ✅ entregue | Levenshtein + Inngest hook + UI alerta no overview. |
| F5 — Draft Workspace | ✅ entregue | Preview/Editar (react-markdown), PATCH cria nova versão, painel Lacunas + Fontes. Export DOCX/PDF documentado P+1. |
| F6 — Review v2 | ✅ entregue | Critérios placeholders/parties_qualified/request_classification/pinned_sources_used/consistency_alerts. Verdict honesto + tooltip. |
| F7 — Tests + docs | ✅ entregue | +44 testes unitários (526 total). `CASE_BRAIN.md` e `DRAFTING_REVIEW_FLOW.md` publicados. |

---

## Atualização — F4/F5 (comandos slash + checklists) — 2026-05-09

### Concluído ✅
- **Comandos slash no relato/intake** com prioridade sobre inferência:
  - Suportados: `/autora`, `/autor`, `/reu`, `/réu`, `/fato`, `/pedido`, `/urgencia`, `/documento`, `/risco`, `/observacao`, `/prazo`, `/valor`.
  - Origem auditável no Case Brain: `origin="user_command"`.
  - Persistência: `persistBrainEntities` agora sincroniza **fatos** e grava `metadataJson` em **partes/pedidos** (quando aplicável).
- **Entrevista guiada**:
  - **Template genérico offline** sempre disponível como fallback.
  - **10 templates por domínio** registrados (mínimo exigido), além do template de creche.

### Testes criados ✅
- `src/lib/cases/slash-commands.test.ts` (parser e tolerância).

### Comandos rodados ✅
- `npm test`
- `npm run typecheck`
- `npm run lint`

### Pendente / riscos ⚠️
- UI ainda não expõe um seletor de template (além de sugestão automática + querystring `?templateId=` no endpoint).
- `CaseFact` não tem `metadataJson` no schema, então origem/status/confiança por fato ficam apenas via `confidence` + timeline/brain.

### Métricas

- **Suite de testes:** 526 testes unitários (482 → 526), 100% verde.
- **Typecheck:** 0 erros.
- **Endpoints novos:** `POST /api/cases/[id]/brain`, `GET/POST /api/cases/[id]/checklist`, `PATCH /api/cases/[id]/drafts/[draftId]`.
- **Tabelas alteradas:** `LegalChunk` (`parentChunkId`), `CaseRisk` (`metadataJson`), enum `CaseTimelineKind` (3 novos), enum `CaseRiskKind` (`DOCUMENT_INCONSISTENCY`).
- **Funções Inngest novas:** `consolidateCaseBrain`, `checkDocumentConsistency`.

