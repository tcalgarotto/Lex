# Case Brain — inteligência consolidada do caso

> Documento de referência para engenheiros e advogados-revisores. Última
> revisão: F7 (Lex Case Brain Refactor).

## Visão geral

O **Case Brain** é o "cérebro" determinístico-com-LLM por trás de todo
caso jurídico no Lex. Ele consolida em uma única estrutura tudo o que o
sistema sabe sobre o caso (dados crus do cliente, respostas do checklist,
texto extraído de documentos, fontes pinadas, fatos extraídos) num único
JSON auditável que é usado por:

- `**renderHeader/renderParties/renderRequests`** do drafter (F4) para
produzir uma minuta sem placeholders mascarados.
- `**computeProceduralReadiness**` (F2.2) para calcular o quão pronta a
peça está e bloquear "Gerar peça" quando faltam dados críticos.
- `**checkDocumentConsistency**` (F4.5) para detectar divergências entre
documentos novos e o brain consolidado.
- `**runReview**` (F6) para validar a peça gerada contra os critérios
explícitos (placeholders, classificação de pedidos, fontes pinadas
usadas, alertas de inconsistência).

## Pipeline (LLM-first auditável)

```
raw_input + checklist + documents + pinned sources
      │
      ▼
heurística determinística (intake / regex / nomes próprios)  ← pré-extração
      │
      ▼
DeepSeek/LLM com JSON schema estrito (consolidação semântica)
      │
      ▼
brain-validator (campo a campo, com cap de comprimento e enums)
      │
      ▼
hash-based cache (Redis) — input identico → mesmo brain
      │
      ▼
Case.metadataJson.brain  (persistido)
```

Cada item extraído carrega `sourceText`, `confidence` (0..1) e `origin`
(`input`, `checklist`, `manual_note`, `rag`, `document:<id>`). Isso
permite responder a qualquer momento "de onde veio essa informação?".

## Contrato

Veja `src/lib/cases/brain-types.ts` para o contrato completo. Resumo:

```ts
type CaseBrain = {
  brainVersion: number;
  inputHash: string;
  degraded?: boolean;             // pipeline rodou só com heurística

  title: string;
  area: string[];
  phase: "pre_processual" | "judicial" | ...;
  problem: string;
  objective: string;
  thesis: string;
  probableMeasure: { kind: ProbableMeasureKind; rationale: string; };
  narrative: string;

  parties: BrainParty[];
  probableAuthority?: BrainAuthority;
  facts: BrainFact[];
  requests: BrainRequest[];
  risks: BrainRisk[];
  evidence: BrainEvidence[];
  missingDocuments: string[];
  suggestedFoundations: SuggestedFoundation[];
  inconsistencies: BrainInconsistency[];

  proceduralReadiness: ProceduralReadiness;  // F2.2
  checklistResponses?: ChecklistResponses;   // F2.1

  generatedAt: string;
};
```

## Como o brain é regerado

### Triggers de reconciliação (Inngest `lex/case.brain`)

1. `POST /api/cases` (modo `raw` ou `existing_process` com rawInput) — após
  `intakeWorkflow`.
2. `POST /api/cases/[id]/checklist` — após o advogado salvar respostas.
3. `POST /api/cases/[id]/brain` — recompute manual via UI.
4. `lex/document.uploaded` → `INDEXED` — após a função
  `ingestDocument` finalizar a indexação Qdrant.

A função `consolidateCaseBrainFn` carrega o caso, junta tudo, chama
`consolidateCaseBrain`, incrementa `brainVersion`, persiste o resultado
em `Case.metadataJson` e registra `CaseTimelineKind.BRAIN_GENERATED`.

### Fail-safe

Se o LLM falhar (timeout, schema inválido, ECONNREFUSED), o pipeline
retorna `degraded = true` com um brain construído apenas pela
heurística. A UI mostra um aviso "Brain em modo degradado — alguns
campos podem estar incompletos."

## Prontidão processual (F2.2)

`proceduralReadiness` é calculado por `computeProceduralReadiness` em
`src/lib/cases/readiness.ts`. Score 0..100, status:

- `insuficiente` (<40 ou com blockers críticos abertos)
- `parcial` (40–69)
- `boa` (70–89)
- `pronta_para_minuta` (≥90 sem blockers)

Existem regras genéricas e regras específicas por checklist
(`CRECHE_RULES`). Cada regra tem `weight`, `blocker?` e `nextActionHint`.

A UI:

- mostra `ReadinessCard` no overview do caso.
- desabilita o botão "Gerar peça" quando `status === "insuficiente"`,
com tooltip explicando qual blocker resolver.
- oferece "Gerar mesmo assim (com lacunas explícitas)" como override
consciente.

## Checklists guiados (F2.1)

`src/lib/cases/checklists/registry.ts` mantém um registry tipado de
templates. O primeiro template é `constitucional.educacao.creche`.
Cada template tem `triggers.keywords` (texto livre) e
`triggers.brainHints` (área detectada) que alimentam `suggestChecklistTemplate`.

A UI (`CaseChecklistTab`) renderiza seções como acordeões, com:

- copy script para entrevistar a cliente (compartilhável por WhatsApp).
- progress bar por seção.
- save persiste em `Case.metadataJson.brain.checklistResponses` e
dispara reconciliação do brain.

## Inconsistência documento × caso (F4.5)

`checkDocumentConsistency` em `src/lib/cases/consistency.ts` compara
nomes (Levenshtein normalizada), CPF/CNPJ, idades, datas dos fatos,
cidade e número CNJ entre o brain e o texto extraído de cada documento.

Inconsistências encontradas viram:

1. `CaseRisk` (kind=`DOCUMENT_INCONSISTENCY`, severity por gravidade,
  metadata com `documentId/evidence/suggestion`).
2. Evento `CaseTimelineEvent` (kind=`DOCUMENT_INCONSISTENCY`).
3. Snapshot leve em `brain.inconsistencies` (regerado completo na
  próxima consolidação).

UI: banner amarelo no overview do caso lista as 4 primeiras
inconsistências e bloqueia o usuário de seguir sem revisar.

## Limitação RAG / Drafting Guard (F4.1)

`getCorpusManifest()` em `src/lib/corpus/manifest.ts` lista, em runtime,
todas as `LegalNorm` ativas no Postgres. O drafter (`renderUrgency`,
`renderLaw`) consulta `decideCitationSync(citation, manifest)` antes de
estampar art. 300 CPC ou Lei 12.016 na peça. Se a norma não está
indexada, vai para a seção "X. Lacunas de complementação" em vez de
aparecer como fundamento ancorado.

A UI da pesquisa jurídica (`/pesquisa-juridica`) também usa o manifest
para mostrar ao usuário "Bases ainda não disponíveis" — evita falsa
expectativa.

## Pontos de auditoria

- Toda extração tem `sourceText`/`origin`/`confidence`.
- `inputHash` é determinístico (sha256 do input + docs + checklist) —
mesmo input ⇒ mesmo brain (sem custo de LLM).
- `brainVersion` incrementa monotonicamente — qualquer edição manual ou
recompute fica rastreada na `CaseTimeline`.
- `Case.metadataJson.brain` é o único snapshot canônico — não duplicar
dados em outras tabelas; usar `buildCaseContext` para ler.

