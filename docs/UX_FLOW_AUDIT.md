# UX Flow Audit — Lex (Caso-centric)

> Documento vivo da auditoria UX do Lex. Última revisão: **2026-05-08 — P0 + P1 + P2 + Hotfix Gemini**.

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
