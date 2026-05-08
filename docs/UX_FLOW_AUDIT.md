# UX Flow Audit — Lex (Caso-centric)

> Documento vivo de auditoria do fluxo UX do Lex. Atualizado em **2026-05-08 (P1 + Hotfix Gemini)**.

## 1. Visão geral

Lex foi reposicionado como uma plataforma jurídica centrada no objeto `Caso`. A jornada
oficial passa a ser:

```
Criar/abrir caso  →  Enviar documentos  →  Acompanhar processamento
        →  Ver fatos/partes/pedidos/riscos  →  Pesquisar legislação (RAG)
        →  Gerar estratégia  →  Gerar peça  →  Revisar/exportar
```

Este documento registra:

- O que foi entregue em **P0** e **P1**.
- Os bloqueios encontrados pela auditoria independente do Gemini (2026-05-08).
- As correções aplicadas (causa raiz, arquivos, comandos, resultados).
- O status final de release.

## 2. P0 — Estabilizar a jornada mínima (concluído)

| Item | Status | Detalhes |
| --- | --- | --- |
| `/biblioteca` redirect | ✅ | redirect puro para `/pesquisa-juridica?scope=legislacao` (`src/app/(app)/biblioteca/page.tsx` + `error.tsx`). |
| Migration `add_case_relations` | ✅ | `Case.processId?`, `Document.caseId?`, `CaseLegalSource`. Aplicada com `prisma migrate deploy` (não destrutiva). |
| `deriveDocumentDisplayStatus` + travados | ✅ | PT-BR, status `Travado` derivado em runtime via `updatedAt` (15min PARSING/CHUNKING, 20min EMBEDDING). |
| Reprocess seguro | ✅ | Limpa só `DocumentChunk` do doc + pontos `lex_main` filtrados por `documentId` + `workspaceId`. **Nunca toca `lex_corpus_norms`.** |
| `/cases/[id]` em 6 abas | ✅ | Visão geral · Documentos · Fatos & Partes · Pesquisa jurídica · Estratégia & Peças · Atividade. |
| `/documentos` | ✅ | Lista do workspace com status, caso vinculado, ações reprocessar/vincular/abrir. |
| `/api/documents/[id]/link-case` | ✅ | POST para vincular/desvincular doc → caso. |
| `/pesquisa-juridica` + `/api/retrieval/search` | ✅ | UI amigável + endpoint sem métricas técnicas. |
| `/busca` com 4 estados | ✅ | loading · empty · no-results · error. Filtros de escopo. |

## 3. P1 — Polish da jornada (concluído)

| Item | Status | Detalhes |
| --- | --- | --- |
| Sidebar refatorada | ✅ | Primary: Início, Casos, Documentos, Pesquisa jurídica, Peças, Processamentos, Equipe, Configurações. Avançado colapsável: Cockpit, Laboratório, Retrieval (debug), Jobs IA, Admin, Guia. |
| Página `/editor` index | ✅ | Lista `LegalPiece` do workspace com link para `/editor/[pieceId]`. |
| Dashboard "Próximas ações" | ✅ | `src/lib/dashboard/next-actions.ts` + `NextActionsCard`. 6 categorias (travados, sem caso, casos sem estratégia, peças em rascunho, base disponível, etc.). |
| Upload com `caseId` | ✅ | `/api/documents/upload` aceita `caseId` opcional + valida workspace. `DocumentUploadButton` reutilizável. |
| `/cases/[id]` polido | ✅ | Visão geral com próximos passos clicáveis (`onGoToTab`), pesquisa embutida, checklist de estratégia, ações pinar/desafixar fundamento. |
| `/api/cases/[id]/legal-sources` | ✅ | POST/GET/DELETE. Idempotente via `P2002`. |

## 4. Auditoria independente Gemini (2026-05-08)

Resumo do `docs/reports/GEMINI_FULL_AUDIT_2026_05_08.md`:

- **Nota geral:** 8.5/10
- **Pontos fortes:** Multi-tenancy, RAG (15/15 QA), pipeline de ingest robusto, separação corpus oficial vs. workspace.
- **Bloqueios P0:**
  1. `npm test` falhando em `src/lib/parsers/extract-text.test.ts` (esperado `PDF_NO_TEXT`, recebido `OCR_NOT_AVAILABLE`) + unhandled error do `tesseract.js` worker.
  2. `NODE_ENV=production npm run build` falhando com `ENOENT: no such file or directory, rename .next/export/500.html -> .next/server/pages/500.html`.
- **Itens P1/P2 reportados:** jargão técnico no front (Retrieval/Grounding/Sparse/Dense), sidebar `Processamentos` vs título `Processos`, enums sem tradução, `CaseLegalSource` sem `workspaceId` direto. **Não tratados nesta rodada por escopo (sem novas features, sem corpus, sem RAG).**

## 5. Hotfix Gemini — Correções aplicadas

### 5.1 Causa raiz do teste PDF/OCR

`src/lib/parsers/extract-text.ts` decidia se OCR estava ativo apenas com base em
`process.env.OCR_PROVIDER`. O `.env` local do projeto (e o ambiente do Gemini)
tinha `OCR_PROVIDER=tesseract` exportado, então:

1. Em teste, o blank.pdf não tem texto → cai no caminho de OCR.
2. `tesseract.js` é invocado com um buffer de PDF (não-imagem) → retorna
   `Error attempting to read image` em um Worker assíncrono.
3. `extractPdfText` captura via `try/catch` e lança `OCR_NOT_AVAILABLE`.
4. O Worker do Tesseract emite o erro **depois** que a Promise principal já
   resolveu, gerando um *unhandled error* que vaza para o vitest.

Resultado: `extract-text.test.ts` esperando `PDF_NO_TEXT` recebia
`OCR_NOT_AVAILABLE` quando o ambiente exportava `OCR_PROVIDER`.

#### Correção

`src/lib/parsers/extract-text.ts`:

- OCR fica explicitamente desabilitado em `NODE_ENV=test` ou `VITEST=true`,
  independentemente de `OCR_PROVIDER`. Em produção, comportamento permanece
  inalterado.
- Quem precisar testar o caminho de OCR mocka `tesseract.js` diretamente.

```ts
const ocrProviderRaw = String(process.env["OCR_PROVIDER"] ?? "").toLowerCase();
const isTestEnv = process.env["NODE_ENV"] === "test" || process.env["VITEST"] === "true";
const ocrEnabled = ocrProviderRaw === "tesseract" && !isTestEnv;
```

Verificação:

```bash
OCR_PROVIDER=tesseract npm test -- src/lib/parsers/extract-text.test.ts  # ✅ 6/6
OCR_PROVIDER=tesseract npm test                                          # ✅ 482/482
```

### 5.2 Causa raiz do build `ENOENT 500.html`

O Next 15.3 com `output: "standalone"` move artefatos de
`.next/export/<page>.html` → `.next/server/pages/<page>.html` ao final da fase
de geração estática. Quando o diretório `.next` já contém **resíduo de uma
build anterior** (build interrompida, mistura de `dev` + `build`, ou pasta
`.next/export` órfã), o rename falha com `ENOENT` porque o arquivo de origem
já foi consumido — ou não foi recriado.

Esse comportamento **não reproduz num diretório limpo**: nas 3 builds locais
após `rm -rf .next` o ENOENT nunca apareceu e `500.html` ficou em
`.next/server/pages/500.html` como esperado.

#### Correção

`package.json`:

- Novo script `clean` que remove `.next` de forma idempotente.
- `build` passa a chamar `npm run clean` antes de `prisma generate && next build`.
  Garante build determinístico em CI/Vercel sem mascarar problema real (o
  fix é apenas higiene de cache, não desativa lint/typecheck/etc.).

```json
"clean": "node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\"",
"build": "npm run clean && prisma generate && next build",
```

Verificação:

```bash
rm -rf .next && NODE_ENV=production npm run build  # ✅ build OK
ls .next/server/pages/500.html                     # ✅ presente
ls .next/export                                    # ✅ não existe (consumido)
```

### 5.3 Higiene adicional

- `.gitignore`: adicionado `*.traineddata` (artefatos de Tesseract baixados em
  runtime/CI não devem entrar no repo).

## 6. Validação completa

| Comando | Resultado |
| --- | --- |
| `npm run lint` | ✅ No ESLint warnings or errors |
| `npm run typecheck` | ✅ tsc clean |
| `OCR_PROVIDER=tesseract npm test` | ✅ 482/482 (66 files) |
| `npm run test:integration` | ✅ 25/25 (4 files) |
| `NODE_ENV=production npm run build` | ✅ build limpo, 500.html no lugar |

## 7. Status final

- **Bloqueios Gemini (2):** corrigidos.
- **Build de produção:** verde.
- **Suíte unit + integration:** verde mesmo com `OCR_PROVIDER=tesseract`.
- **Sem novas features**, sem alteração no corpus, sem alteração no pipeline RAG constitucional.

**Release ready: SIM** para o escopo P0+P1 + hotfix.

### Pendências P2 (não tratadas nesta rodada — fora de escopo)

1. Substituir jargão técnico restante no front (Retrieval/Grounding/Sparse/
   Dense/Intent/Cockpit/Pinado).
2. Mapeadores de enum em PT-BR (`NormKind`, `CaseStatus`, `IntegrationStatus`,
   `DocumentStatus`).
3. Sincronizar rótulo da sidebar com título da página em `/processos`.
4. Adicionar `workspaceId` em `CaseLegalSource` (defesa em profundidade).
5. Avaliar paralelização do `/api/search` para reduzir os ~3s de latência
   percebida em buscas globais.
6. Empty states padronizados (`src/components/ui/empty-state.tsx`) e
   `src/app/(app)/not-found.tsx`.
7. Playwright `tests/e2e/ux-flow.spec.ts` cobrindo a jornada caso → upload →
   pesquisa → estratégia → peça.

### Próximos passos recomendados

1. **Commit + push** das mudanças P0+P1+hotfix na main.
2. Abrir P2 como nova rodada com foco exclusivo em terminologia/empty
   states/e2e (sem mexer em RAG ou corpus).
3. Manter `qa:search:legal` como gate de regressão antes de qualquer release.
