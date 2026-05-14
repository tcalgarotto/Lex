# Achados de validação técnica (mundo real) — P0 integração 2026-05-10

## O que estava quebrado ou incoerente

- **Estratégia do caso** ainda carregava o tab legado (`CaseStrategyPiecesTab`) em vez do fluxo Lane D (`CaseDraftingTab`).
- **Pin / marcar verificado** nas rotas globais de pesquisa retornavam **202 shim** sem persistir no caso.
- **`case-brain-shim`** no drafting lia apenas fontes só do corpus indexado (legado) e ignorava pins do Case Brain em `metadataJson`.
- **Pesquisa no caso** enviava `caseBrainSummary` e omitia `resultTypes`, incompatível com o schema da Lane A; a resposta era tratada como `{ result }` mas a API devolve o corpo **plano**.
- **Pesquisa global** chamava `recommend-for-case` sem `caseId` obrigatório; 404/501 eram silenciados como “stub”.
- **Typecheck**: `activity-log` (`metaJson`) e cast em `pinned-foundations` API; **ESLint**: `prefer-const` em export PDF.

## O que foi corrigido (Lane E)

- Lazy-load de estratégia → `CaseDraftingTab`; página `estrategia` simplificada.
- `POST /api/legal-research/pin` e `mark-verified` integrados a `@/lib/cases/case-brain`.
- Shim de drafting adapta `getCaseBrainSnapshot` / `listPinnedFoundations` / `markPinnedFoundationVerified` ao contrato interno.
- `case-research-tab` consome `GET /api/cases/[id]/case-brain`, payload `recommend-for-case` válido, parsing da resposta alinhado ao provider.
- `global-pesquisa-workbench` usa `/search` sem caso e `/recommend-for-case` com `caseId`.
- `next-actions` e `strategy-gaps-panel` com hrefs nas rotas por seção.
- Testes Vitest em `tests/**` + inclusão no `vitest.config.ts`.
- Ajustes de tipo/ESLint mínimos para lint/typecheck/build verdes.

## O que permanece aberto (honesto)

- **`src/lib/legal-research/types.ts` ainda não está versionado no git** (`git status` mostra `??`) — precisa `git add` humano quando o conjunto Lane A for commitado.
- **Admin / jobs**: gating só no menu não basta; itens do audit de segurança seguem ⏳ (`SECURITY_REVIEW_P0.md`).
- **Unificação `claims` vs `requests`**: duas superfícies mantidas de propósito; TODO de produto.
- **Inngest `case-ready-for-research`**: placeholder deliberadamente **não** registrado.
- **E2E sentinela** desta leva: não reexecutado nesta sessão completa de Playwright após todos os swaps (recomendado antes de declarar release amplo).
