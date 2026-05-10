# Plano P0 — reparo do fluxo do caso (orientou Lanes B + C)

## Ordem canônica das seções (6)

1. Visão geral — `/cases/[id]`
2. Entrevista guiada — `/cases/[id]/entrevista`
3. Partes e fatos — `/cases/[id]/partes-fatos`
4. Documentos — `/cases/[id]/documentos`
5. Pesquisa jurídica — `/cases/[id]/pesquisa-juridica`
6. Estratégia e peças — `/cases/[id]/estrategia`

Compat: `?tab=` redirecionado por `CaseLegacyQueryRedirect`.

## Contratos entre camadas

| Origem | Destino | Contrato |
|--------|---------|----------|
| UI pesquisa | Lane A | `POST /api/legal-research/search` (sem caso) ou `recommend-for-case` (com `caseId`, `resultTypes`, `caseBrain?`, `query`) |
| UI pin | Lane A + B | `POST /api/legal-research/pin` com `{ caseId, foundation \| jurisprudence }` → `addPinnedFoundationToCase` |
| UI verificado | Lane A + B | `POST /api/legal-research/mark-verified` com `{ caseId, pinnedId \| candidateId, kind }` |
| Drafting | Case Brain | `case-brain-shim` espelha `getCaseBrainSnapshot` / pins para `generate-strategy` / `generate-draft` |
| Pesquisa caso | Case Brain | `GET /api/cases/[id]/case-brain` para counts + narrative |

## Persistência

- Pins e fingerprint em `Case.metadataJson.caseBrain` (sem migration nova).
- `drafting-guard` permanece obrigatório antes de gerar minuta.

## Decisões explícitas

- **Não** registrar Inngest `case-ready-for-research` no P0.
- Manter **`/api/cases/[id]/claims` e `/requests`** em paralelo até unificação futura.
