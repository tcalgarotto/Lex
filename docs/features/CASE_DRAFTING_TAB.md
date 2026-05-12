# Aba Estratégia e Peças (P0 — Lane D)

Sign-off provisório F-1: escopo interno e demo controlada; promoção a produção pública bloqueada. Owners Legal / Segurança / QA ainda provisórios.

## Objetivo

Centralizar **estratégia assistida (DeepSeek)**, **minuta (Markdown, DeepSeek)**, **revisão assistida (DeepSeek + heurísticas locais)**, **promoção para `LegalPiece`**, **exportação** (DOCX / PDF / Markdown) com **guardas de geração** e transparência sobre lacunas e julgados candidatos.

## Arquitetura de UI

- **Coluna esquerda:** passos sugeridos (referência operacional) + **prontidão do caso** (percentual = `metadataJson.brain.proceduralReadiness.score` quando existir).
- **Coluna central:** editor em **Markdown** com barra de formatação (inserção de sintaxe), pré-visualização (`react-markdown`) e largura máxima ~720px.
- **Coluna direita:** abas **IA · Lacunas · Fundamentos · Julgados** com ações de inserção no texto.

### Escolha do editor

O monólito já inclui TipTap, porém o armazenamento oficial da minuta (`CaseDraft.content`) é **Markdown texto**. Para evitar conversões frágeis entre ProseMirror e Markdown, a aba usa **área de edição + pré-visualização Markdown**. TipTap permanece disponível para evoluções futuras com serialização alinhada ao banco.

## Contratos com outras lanes

| Lane | Contrato |
|------|------------|
| **A (pesquisa)** | Tipos de `LegalFoundationCandidate` / `JurisprudenceCandidate` importados de `@/lib/legal-research/types` quando necessário. Candidatos não verificados nunca são tratados como decisão confirmada. |
| **B (Case Brain)** | Shim provisório em `src/lib/cases/drafting/case-brain-shim.ts` expõe `getCaseBrainSnapshot`, `listPinnedFoundations`, `listPinnedJurisprudenceCandidates`, `markPinnedFoundationVerified` até API canônica em `@/lib/cases/case-brain`. |
| **C (shell do caso)** | Importar `CaseDraftingTab` de `@/components/cases/strategy/case-drafting-tab` na aba Estratégia. Registrar no `UX_FLOW_AUDIT.md` (TODO Lane C). |
| **E (QA)** | Rodar lint, typecheck, testes e substituir shims por integrações finais. |

## Drafting-guard

Implementado em `src/lib/cases/drafting/drafting-guard.ts` e aplicado em `generateDraft` + banner na UI (`previewDraftingGuardMessages`).

Bloqueios principais:

1. Parte autora ausente (parte relacional `AUTHOR` ou parte do cérebro com papel `assisted_party`).
2. Nenhum fato essencial (tabela `CaseFact` ou fatos do cérebro).
3. Nenhum fundamento pinado (`CaseLegalSource` e/ou pins assistidos espelhados).
4. Estratégia P0 ausente ou não aprovada (`draftingStrategy` + `draftingStrategyApproved`).
5. Fundamentos ou julgados com **indicação automática** (`AI_RECOMMENDED_UNVERIFIED`) sem confirmação explícita (`confirmUnverifiedFoundations: true` no POST de geração ou checkbox na UI).

Resposta bloqueada: `{ status: "blocked", reasons: string[] }` (HTTP **409** na rota de geração).

## Estratégia assistida

- `GET /api/cases/[id]/strategy` — estratégia legada (`strategy`), estratégia P0 (`draftingStrategy`), aprovação, prontidão e jurisprudências candidatas.
- `POST /api/cases/[id]/strategy` — gera `draftingStrategy` via **DeepSeek** (`generateStrategy`); atualiza objeto legado `strategy` para compatibilidade; **sem** `retrieveLegalContext`.
- `POST /api/cases/[id]/strategy/generate` — mesmo núcleo que `POST /strategy` (preferir um dos dois na UI para evitar duplicidade).
- `POST /api/cases/[id]/strategy/approve` — grava `metadataJson.draftingStrategyApproved`.

## Minutas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cases/[id]/drafts` | Lista versões. |
| POST | `/api/cases/[id]/drafts` | Cria versão com **minuta gerada por DeepSeek** (`generateDraft`) e guardas; HTTP 409 se bloqueado. |
| GET | `/api/cases/[id]/drafts/[draftId]` | Detalhe. |
| PATCH | `/api/cases/[id]/drafts/[draftId]` | Salva edição manual como **nova versão** (F5). |
| POST | `/api/cases/[id]/drafts/[draftId]/generate` | Regenera conteúdo com guardas (mesmo núcleo). |
| POST | `/api/cases/[id]/drafts/[draftId]/review` | Revisão **DeepSeek** + heurísticas; persiste em `CaseReview`. |
| POST | `/api/cases/[id]/drafts/[draftId]/promote` | Promove Markdown → `LegalPiece` (TipTap) e abre `/editor/[pieceId]`. |
| GET/POST | `/api/cases/[id]/drafts/[draftId]/export` | DOCX / PDF / Markdown com estrutura (títulos, listas, citações). |

## Exportação

- Biblioteca compartilhada: `src/lib/cases/drafting/drafting-markdown-export.ts` (`docx` + `pdf-lib`).
- DOCX: estilos de título Word (`HeadingLevel`) e blocos de citação indentados.
- PDF: títulos por tamanho de fonte, rodapé com paginação; **PDF tagged** — TODO quando houver suporte sem regressão visual.
- Peças (`/api/pieces/[id]/export`): GET/POST reutilizam o mesmo motor a partir do texto plano do editor TipTap da peça.

## Anti-alucinação / tom de produto

- Não expor ao usuário termos internos (ex.: nomes de armazenamentos técnicos ou motores de busca).
- Julgados **candidatos** carregam aviso explícito e nunca são promovidos a “verificados” sem ação humana.
- Fundamentos só entram na geração a partir de **pins** (trechos curados no caso).

## Rate limit

Rotas sensíveis usam `enforceDraftingRateLimit` (~12 req/min por chave usuário+IP) com cabeçalhos `X-RateLimit-*` quando aplicável.

## Responsabilidades fora desta lane

- Persistência avançada de verificação de pins (`markPinnedFoundationVerified` hoje é no-op documentado).
- Fonte canônica de julgados candidatos no `Case.metadataJson` (acordo com pesquisa jurídica).
- Integração da aba no layout do caso (`case-tabs` / rota).
