# Aba Pesquisa jurídica (dentro do caso)

## Objetivo

Centralizar **busca assistida** (modo DeepSeek temporário) e **fundamentos fixados** no caso, com linguagem de produto e rastreabilidade, sem confundir com a biblioteca ou documentos brutos.

## Dados

- **Case Brain** (`GET /api/cases/[id]/case-brain`): narrative, contagens, fingerprint — usado para montar `caseBrain` em `recommend-for-case`.
- **Fundamentos fixados (corpus)**: continuam em `CaseLegalSource` via fluxo existente de biblioteca e pins no corpus indexado quando aplicável.
- **Fundamentos fixados (assistido)**: `POST /api/legal-research/pin` persiste em `metadataJson.caseBrain.pinnedFoundations` (Lane B).

## Integração Lane A

- `POST /api/legal-research/recommend-for-case` — corpo alinhado a `legalResearchRecommendBodySchema` (`resultTypes`, `caseBrain`, `query`, …).
- Resposta: `LegalResearchResponse` **no corpo JSON** (não encapsulada em `{ result }`).

## UX

- Banner de transparência (`USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP`).
- Jurisprudência candidata com aviso se faltar processo/fonte.
- Link para pesquisa em tela cheia `/pesquisa-juridica?caseId=…`.

## Relacionados

- `docs/features/LEGAL_RESEARCH_DEEPSEEK_MODE.md`
- `docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md`
- `docs/UX_FLOW_AUDIT.md`
