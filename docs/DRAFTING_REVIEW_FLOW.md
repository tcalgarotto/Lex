# Drafting + Review — fluxo completo

> Como o Lex transforma um Case Brain em uma minuta auditável e a
> revisa contra critérios objetivos. Última revisão: F7.

## Diagrama de alto nível

```
              ┌─────────────────────────────────────────┐
              │  Case Brain (consolidateCaseBrain)      │
              │  + pinnedSources + documentos extraídos │
              └────────────────┬────────────────────────┘
                               │
                               ▼
            ┌──────────────────────────────────────┐
            │  draftWorkflow (orchestrator.ts)     │
            │  ─ buildCaseContext                  │
            │  ─ retrieveLegalContext              │
            │     · queries derivadas do brain     │
            │     · mustInclude = pinnedSources    │
            │     · caseContext = brain.area/      │
            │       brain.problem (topic-aliases)  │
            │  ─ synthesizeStrategy                │
            │  ─ buildDraft (drafting.ts)          │
            │  ─ persistDraft + timeline DRAFT_GENERATED
            └────────────────┬─────────────────────┘
                               │
                               ▼
              CaseDraft v(N+1) em Markdown
              + groundingChunkIds[]
              + metadataJson { lacunas, unindexedFoundations,
                               usedBrainContext, usedPinnedSources,
                               brainVersion }
                               │
                               ▼
            ┌──────────────────────────────────────┐
            │  reviewWorkflow                      │
            │  ─ runReview (review.ts F6)          │
            │     critérios:                       │
            │       structure, grounding,          │
            │       placeholders, parties_qualified│
            │       main_request,                  │
            │       request_classification,        │
            │       urgency_consistency,           │
            │       facts, pinned_sources_used,    │
            │       consistency_alerts,            │
            │       revoked, divergence, issues    │
            │  ─ verdict realista                  │
            │  ─ persistReview + timeline REVIEW_RUN│
            └────────────────┬─────────────────────┘
                               │
                               ▼
            CaseStatus → READY (somente se verdict=Pronta para protocolo)
            ou → REVIEW (qualquer outro caso)
```

## Drafting v2

Arquivo: `src/lib/cases/drafting.ts`.

Mudanças vs v1:

- **`renderHeader`** escolhe rito (MS / obrigação de fazer) a partir de
  `brain.probableMeasure.kind` em vez de chutar pelo tribunal genérico.
- **`renderParties`** consome `brain.parties` (com endereço/contato/
  relação). Só cai em `_Partes a qualificar._` quando NADA está
  disponível (e adiciona uma lacuna explícita ao painel).
- **`renderLaw`** prioriza pinned sources (todas), depois preenche com
  retrieval, e filtra ADCT irrelevante quando a área não pede.
- **`renderRequests`** usa `brain.requests` quando existem; agrupa por
  kind (URGENCY/MAIN/SUBSIDIARY/PROVISIONAL/PROCEDURAL).
- **`renderUrgency`** chama `assertCitationAllowed` antes de citar
  art. 300 CPC ou Lei 12.016 — se a norma não está indexada, a citação
  migra para a seção "X. Lacunas de complementação" (F4.1).
- Valor da causa = lacuna explícita quando ausente, em vez de placeholder
  mascarado.
- Resultado inclui `lacunas[]` e `unindexedFoundations[]` para o Draft
  Workspace (F5) e o Review v2 (F6).

### `mustInclude` no retrieval

`pinnedSources` (ou `Case.legalSources`) viram `mustInclude` na opção
de `retrieveLegalContext`. Implementação: pós-processo carrega chunks
faltantes do banco e os prepende ao topo do resultado final, garantindo
que apareçam tanto no `groundingChunkIds` quanto no texto da peça.

### Lacunas

`buildDraft` retorna `lacunas[]` populado por:

- `renderHeader`: "Definir juízo competente", "Identificar autoridade
  coatora".
- `renderParties`: "Identificar partes…".
- `renderFacts`: "Coletar e organizar fatos…".
- `renderRequests`: "Definir pedidos jurídicos…", "Reclassificar…".
- `renderValue`: sempre "Definir valor da causa…".
- `renderClosing`: sempre "Preencher local, data, OAB…".

Essas lacunas aparecem no painel direito do Draft Workspace e no
Review v2 (item `placeholders`).

### Fontes não indexadas

`renderUrgency` chama `decideCitationSync(citation, corpusManifest)`
para CPC e Lei 12.016. Se `decision.allowed === false`, a citação é
adicionada a `unindexedFoundations[]` e renderizada na seção
"X. Lacunas de complementação" com `suggestedUse`.

`KNOWN_NORM_PATTERNS` (em `drafting-guard.ts`) lista padrões
heurísticos para detectar referências a CPC/ECA/LDB/Lei MS/CDC/CC em
texto livre — usado pelo Review v2 para alertar caso a peça cite
explicitamente uma norma fora do corpus.

## Draft Workspace (F5)

Arquivo: `src/components/cases/case-drafts-tab.tsx`.

UI dividida em duas colunas:

- **Esquerda — Preview / Editar**: Preview com `react-markdown` (GFM
  habilitado), Editar com textarea monoespaçada e "Salvar como nova
  versão" (cria v(N+1) com status `EDITED`, herda groundingChunkIds,
  salva metadataJson `editedFromVersion`).
- **Direita — Painel auxiliar**:
  - "Fontes usadas" lista os primeiros 8 `groundingChunkIds`.
  - "Lacunas" lista `metadata.lacunas` (amarelo).
  - "Fundamentos a complementar" lista `metadata.unindexedFoundations`
    (violeta).
  - "Seções" lista o índice gerado.

Endpoint: `PATCH /api/cases/[id]/drafts/[draftId]` com `{ content }`.

Export DOCX/PDF está documentado para P+1 (não nesta release).

## Review v2 (F6)

Arquivo: `src/lib/cases/review.ts`. Critérios novos:

| id                        | peso | bloqueante? | Fonte                          |
|---------------------------|-----:|:-----------:|--------------------------------|
| structure                 | 0.15 | parcial     | regex H2 do markdown           |
| grounding                 | 0.18 | sim         | `groundingChunkIds`            |
| placeholders              | 0.12 | sim         | regex `[local]`, `_Lacuna:_`   |
| parties_qualified         | 0.10 | sim         | parties × draftContent         |
| main_request              | 0.12 | sim         | `requests.kind === MAIN`       |
| request_classification    | 0.06 | parcial     | % `kind !== OTHER`             |
| urgency_consistency       | 0.08 | não         | seção VI vs requests URGENCY   |
| facts                     | 0.12 | parcial     | `facts.length`                 |
| pinned_sources_used       | 0.05 | parcial     | pinned ⊂ groundingChunkIds     |
| consistency_alerts        | 0.06 | sim         | `CaseRisk DOCUMENT_INCONSISTENCY` ativos |
| revoked                   | 0.12 | parcial     | risks.contradiction            |
| divergence                | 0.08 | não         | risks.contradiction            |
| issues                    | 0.15 | parcial     | issue-spotting                 |

### Verdict

```ts
function deriveVerdict(score, items) {
  blockers = items.filter(blocker && fail);
  if (blockers.length > 0) return "Não-protocolável: N bloqueante(s) crítico(s)";
  if (fails.length > 0) return "Pendências críticas (F fail / W avisos)";
  if (score >= 0.9 && warnings === 0) return "Pronta para protocolo";
  if (score >= 0.85) return "Quase pronta — N aviso(s) para revisar";
  if (score >= 0.7) return "Em revisão — N aviso(s)";
  return "Em construção — revisão necessária";
}
```

Antes (v1): `score >= 0.85 && fails === 0` → "Pronta para protocolo".
Agora (v2): só "Pronta para protocolo" quando 100% dos critérios
bloqueantes passam, score ≥ 0.9 e zero warnings. O `CaseStatus` só
promove a `READY` quando o verdict é exatamente esse.

### UI

`CaseReviewTab` agora mostra:

- Card do verdict com borda colorida pelo tom (verde/âmbar/vermelho).
- Tooltip explicativo (`Info` ícone) por item quando há `rationale`.
- Tooltip global no verdict explicando por que foi atribuído.

## Auditoria

Cada draft persiste no `metadataJson`:

- `sections`: índice com chars por seção (para diagnóstico).
- `groundingScore`, `confidence`: do retrieval.
- `query`: a string usada no retrieval (auditável).
- `issuesCount`, `risksCount`.
- `lacunas`, `unindexedFoundations`: para o painel direito.
- `usedBrainContext`, `usedPinnedSources`, `brainVersion`: para
  rastrear se o draft foi gerado com ou sem brain consolidado.
- `editedFromVersion`, `editedById`, `editedAt` (em drafts EDITED).

Cada review persiste:

- `score`, `verdict`, `checklistJson` (com items + rationale).

Toda mudança de status (`DRAFTING → REVIEW → READY → FILED`) gera um
evento na `CaseTimeline`.
