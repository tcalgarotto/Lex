# Case Brain — arquitetura e contratos (P0)

Sign-off provisório **F-1 (2026-05-10)**. Release público bloqueado; owners Legal/Security/QA provisórios — cada PR Tier-S exige nota de dupla revisão (PO + CTO interim).

## Objetivo

Consolidar relato livre, entrevista guiada e documentos em **partes, fatos, pedidos (claims), riscos** com trilha de auditoria (`origem`, `sourceText`, `confidence`, `lockedByUser`), alimentar **prontidão processual** e expor um **snapshot** único para as lanes de produto (pesquisa jurídica, UI de caso, estratégia/peças).

## Shape canônico

### Tabelas Prisma (persistência relacional)

| Entidade | Modelo | Metadados auditáveis |
|----------|--------|------------------------|
| Parte | `CaseParty` | `metadataJson` |
| Fato | `CaseFact` | `metadataJson` |
| Pedido | `CaseRequest` | `metadataJson` |
| Risco | `CaseRisk` | `metadataJson` |
| Caso | `Case` | `metadataJson` — contém `brain`, `brainVersion`, `caseBrain` |

Não há migration nova no P0: tudo que não couber em colunas usa `metadataJson` / `Case.metadataJson`.

### `Case.metadataJson`

- **`brain`**: objeto `CaseBrain` (consolidação LLM + heurísticas) — ver `src/lib/cases/brain-types.ts`.
- **`brainVersion`**: número incrementado a cada consolidação bem-sucedida.
- **`caseBrain`**: envelope estável para consumo cross-lane:
  - `pinnedFoundations[]`: fundamento ou jurisprudência pinada (ver abaixo). Ao fixar pela pesquisa assistida, o servidor cria também uma linha em `CaseLegalSource` com `chunkId` sintético (`lex-assisted-pin:` / `lex-assisted-juris:`) para unificar a lista “Fundamentos fixados” nas abas do caso.
  - `caseFingerprint`: hash do estado relacional (ver `computeCaseFingerprint`).
  - `documentSemanticIndexDocIds[]` (opcional): ids de `Document` do caso com **opt-in** para indexação semântica no acervo. **Padrão:** documentos do caso **não** entram nessa indexação; apenas leitura de texto + uso no caso.

### Origem (`metadataJson.origem`)

Valores esperados:

`entrevista_guiada` | `documento_OCR` | `manual` | `deepseek_recommendation` | `ia_extracao`

Espelho legado: `origin` / `source` (mantidos onde já existiam).

### Status (`metadataJson.status`)

`extraido` | `sugerido` | `confirmado` | `manual` | `duvida`

Regras:

- Extrações automáticas usam **`sugerido`** por padrão.
- **`confirmado`** e **`manual`** têm prioridade semântica para curadoria humana.
- **`lockedByUser: true`** ou status `confirmado` / `manual` → consolidação automática **não sobrescreve** o registro (inserções duplicadas por texto são suprimidas onde aplicável — ver `persistBrainEntities` em `brain.ts`).

## Pipelines

### 1. Entrevista guiada → dados estruturados

1. Cliente chama `POST /api/cases/[id]/intake/answer` com `templateId`, `value` (texto), opcional `fieldId`, `mergeChecklist`.
2. Respostas relevantes são mescladas em `metadataJson.brain.checklistResponses` (quando `mergeChecklist` e template resolvido).
3. `mergeInterviewExtractIntoCase` (`src/lib/cases/case-brain/interview-extraction.ts`) aplica heurísticas + `runIntake` e grava sugestões em `CaseParty` / `CaseFact` / `CaseRequest` / `CaseRisk` com `origem: "entrevista_guiada"` e `status: "sugerido"`.
4. Prontidão parcial é recalculada e escrita em `metadataJson.brain.proceduralReadiness`.
5. Evento Inngest `lex/case.brain` com `source: "intake_answer"` dispara recomputação completa (assíncrona).

Estado da entrevista: `GET /api/cases/[id]/intake/state`.

### 2. Documentos do caso

1. `POST /api/cases/[id]/documents` (multipart `file`) cria `Document` com `caseId`, status inicial mapeável para **PROCESSING** na UI.
2. `lex/document.ingest` extrai texto. Se **não** houver opt-in em `caseBrain.documentSemanticIndexDocIds`, o fluxo encerra após texto com status `INDEXED`, progresso 1 e **sem** vetores no acervo (somente leitura no caso).
3. `GET .../extracted-text` devolve o texto extraído.
4. `POST .../documents/[docId]/suggest` gera sugestões determinísticas e persiste itens com `origem: "documento_OCR"`.
5. `POST .../documents/[docId]/retry` reenfileira a leitura após falha.

Mapeamento de status para UI (sem expor enum interno cru ao usuário final): ver campo `uiStatus` nas respostas JSON (`READY` | `FAILED` | `PROCESSING`).

### 3. Consolidação global (`lex/case.brain`)

Worker: `src/lib/inngest/functions/consolidate-case-brain.ts`. Persiste `brain` em `Case.metadataJson` com **`mergeCaseMetadataJson`** para não apagar `caseBrain.pinnedFoundations` / políticas.

`persistBrainEntities` (`src/lib/cases/brain.ts`) insere apenas o que falta; anexa `origem`/`status`/`sourceText` em novos fatos/pedidos/riscos; respeita fatos com `lockedByUser` na deduplicação por prefixo de texto.

## Fundamentos pinados (Lane A)

Funções exportadas em `src/lib/cases/case-brain/pinned-foundations.ts`:

- `addPinnedFoundationToCase(caseId, workspaceId, candidate, pinnedByUserId?)`
- `listPinnedFoundations(caseId, workspaceId)`
- `markPinnedFoundationVerified(caseId, workspaceId, pinnedId, verifiedBy)`
- `removePinnedFoundation` (usado pela rota `DELETE`)

Tipos: `LegalFoundationCandidate` / `JurisprudenceCandidate` de `@/lib/legal-research/types`.

Rotas HTTP:

- `GET/POST /api/cases/[id]/pinned-foundations`
- `DELETE /api/cases/[id]/pinned-foundations/[pinnedId]`
- `POST /api/cases/[id]/pinned-foundations/[pinnedId]/mark-verified`

## Snapshot para Lanes C / D

`getCaseBrainSnapshot(caseId, workspaceId)` em `src/lib/cases/case-brain/snapshot.ts` — exposto via `GET /api/cases/[id]/case-brain`.

Inclui: partes, fatos, claims (requests), riscos, documentos com `uiStatus`, `brain`, `pinnedFoundations`, `caseFingerprint`.

## Fingerprint

`computeCaseFingerprint(caseId, workspaceId)` — hash do conjunto relacional + `brainVersion`.

`touchCaseBrainFingerprintAfterMutation` atualiza `caseBrain.caseFingerprint` após mutações CRUD.

## Activity (auditoria workspace)

`recordCaseMutationActivity` grava em `Activity` com `metaJson` higienizado (sem PII bruta).

## Eventos

- `lex/case.brain` — já existente; fontes adicionais: `intake_answer`, `document_text_ready`, etc.
- **`lex/case.ready-for-research`**: reservado para integração futura; **Lane E** deve registrar handler no `src/app/api/inngest/route.ts` se desejado. Hoje a recomputação é disparada via `lex/case.brain`.

## TODOs por lane

| Lane | Ação |
|------|------|
| A | Consumir `addPinnedFoundationToCase`, `listPinnedFoundations`; garantir tipos em `@/lib/legal-research/types`. |
| C | Trocar fetches para `GET /api/cases/[id]/case-brain` e novas rotas REST com `[entityId]` quando conveniente. |
| D | Consumir snapshot + pins para estratégia e peças. |
| E | Registrar `lex/case.ready-for-research` se necessário; rodar lint/typecheck/test/build; registrar função Inngest se criada. |

## Referências de código

- `src/lib/cases/case-brain/` — módulo canônico P0.
- `src/lib/cases/brain.ts` — consolidação + `persistBrainEntities`.
- `src/lib/inngest/functions/ingest-document.ts` — opt-out de indexação semântica para docs do caso.
