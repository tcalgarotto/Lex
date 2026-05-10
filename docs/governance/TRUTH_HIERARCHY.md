---
title: Truth Hierarchy — Lex
status: reviewed
owners: [Legal Lead, PO, CTO]
audience: [dev, admin, investor]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/PRODUCT_SURVIVAL_MODE.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/FORBIDDEN_ORDERINGS.md
  - docs/governance/BENCHMARK_STRATEGY.md
tier: mvp
---

# Truth Hierarchy — Lex

> **Documento canônico da hierarquia absoluta de verdade jurídica do Lex.** Define **o que pode ser citado**, **o que pode fundamentar peça**, **o que sobrescreve o que** e **o que é apenas sugestão**. Sem essa hierarquia, "fonte" vira opinião e o produto vira chute com retórica.

> **Princípio fundamental**: **IA nunca é fonte primária de verdade jurídica**. IA processa, organiza e sugere; **a verdade está no corpus oficial e nos artefatos do caso**.

> **Princípio operacional**: **base ausente = lacuna, nunca fundamento**. Se não existe fonte oficial citável, o produto **diz** que não existe e **não inventa**.

---

## 1. Os 11 níveis (do mais alto ao mais baixo)

> Convenção de leitura: nível **menor (1)** = **mais alto** na hierarquia (verdade primária); nível **maior (11)** = **mais baixo** (sugestão derivada). **Nunca** o nível N pode sobrescrever, contradizer ou substituir o conteúdo de um nível N-K (K ≥ 1).

### Nível 1 — Legislação oficial vigente

- **O que é**: normas jurídicas brasileiras em vigor na data de referência (`asOf`), publicadas em fonte oficial (Planalto, DOU, Diário Oficial estadual, LexML).
- **No código**: representado por `LegalNorm` + `LegalNormVersion` (com `validFrom`/`validTo`/`contentHash`) + `LegalChunk` (com `vectorPointId`, `articleRef`, `fullPath`).
- **Exemplos**: Constituição Federal/88, Código Civil (Lei 10.406/2002), CDC (Lei 8.078/1990), CPC (Lei 13.105/2015), MPs em vigor, Decretos, ECs.
- **Identificação canônica**: URN-LEX (`urn:lex:br:federal:lei:2002-01-10;10406`).

### Nível 2 — Jurisprudência oficial

- **O que é**: súmulas (vinculantes ou comuns) e acórdãos publicados oficialmente por tribunal superior (STF, STJ, TST) ou por tribunal local com referência verificável.
- **No código**: `LegalNorm` com `kind` em `{SUMULA_VINCULANTE, SUMULA_STF, SUMULA_STJ, SUMULA_TST, JURISPRUDENCE}`; coleção Qdrant `lex_corpus_jurisprudence`.
- **Exemplos**: SV 14, Súmula STJ 297, acórdão STF Tema XYZ.
- **Status atual** (Leva 1 §5.4): `STJ` provider real é **scaffold**; promover para "jurisprudência oficial" exige adapter `live` validado.

### Nível 3 — Tribunal / Processo oficial

- **O que é**: dados processuais reais retornados por tribunais via PJe / e-SAJ / Projudi / eproc / DataJud (CNJ).
- **No código**: integrações em `src/lib/integrations/{pje,esaj,projudi,eproc,datajud}` (em modo `mock` por padrão; `live` exige `secretRef` + LGPD).
- **Exemplos**: andamentos, decisões interlocutórias, pautas, intimações.
- **Limite**: pode **provar** que algo aconteceu naquele processo; **não** cria norma.

### Nível 4 — Documentos do caso

- **O que é**: arquivos enviados pelo escritório para um caso específico (petições, contratos, laudos, comprovantes, e-mails).
- **No código**: `Document` + `DocumentChunk` + parsing/OCR em `src/lib/parsers/**`; vinculação ao caso via `Document.caseId` (e/ou processo via `Process`).
- **Limite**: prova **fato** dentro daquele caso; **não** cria norma; **não** vale para outros casos sem ApprovedLegalFoundation derivada.

### Nível 5 — Fundamentos pinados / aprovados (`ApprovedLegalFoundation`)

- **O que é**: trecho de norma / jurisprudência **explicitamente aprovado** pelo advogado para um caso, com origem citável e revisão humana.
- **No código**: `ApprovedLegalFoundation` (migration `20260509190000_library_foundations`).
- **Limite**: o conteúdo só pode ser usado se a **fonte original** existe nos níveis 1, 2 ou 3. ApprovedLegalFoundation é o **vínculo curado**, não a fonte em si.

### Nível 6 — Peças aprovadas do escritório

- **O que é**: peças que passaram revisão humana (verdict aprovado em `DraftApproval`).
- **No código**: `Draft` + `DraftApproval` + `Piece` (quando finalizada).
- **Limite**: ensina **estilo**, **estrutura**, **estratégia** preferida — **nunca** vira norma. Reutilização em novo caso exige re-validação dos fundamentos vs. níveis 1-3.

### Nível 7 — Memória do escritório (opt-in)

- **O que é**: padrões aprendidos do uso do escritório (estilos, snippets, cláusulas, fundamentos preferidos, glossário interno).
- **No código**: `OfficeMemory` (migration `20260509220000_office_memory`); `lawyer-brain/**`; `style-engine.ts`.
- **Limite**: **opt-in obrigatório** (LGPD); nunca cruza workspaces; nunca é fonte jurídica primária; sempre marcada como sugestão.

### Nível 8 — Modelos / templates internos

- **O que é**: modelos de peça/checklist/intake oferecidos pelo Lex (curados pelo time).
- **No código**: `InterviewTemplate` (migration `20260509151000_interview_template_model`); `cases/checklists/templates/**`.
- **Limite**: ensina **estrutura**, **roteiro**; texto literal de modelo **não** é fundamento jurídico.

### Nível 9 — Inferência IA

- **O que é**: saída de LLM (resumos, sínteses, sugestões de pedido, hipótese de risco).
- **No código**: `src/lib/ai/**`, `legal/reasoning/**`, `lawyer-brain/**`.
- **Limite**: **sempre rotulada como sugestão**; **não** entra em peça final sem ancoragem em níveis 1-5; sujeita a `drafting-guard` + `source-sufficiency`.

### Nível 9b — Inferência DeepSeek (pesquisa jurídica assistida externa, P0 temporário)

- **O que é**: JSON estruturado de fundamentos e jurisprudência **candidatos** produzido pelo modo `LEGAL_RESEARCH_PROVIDER=deepseek` (`src/lib/legal-research/**`), sem substituir o índice interno.
- **No código**: `DeepSeekLegalResearchProvider`, rotas `/api/legal-research/*`, normalização + `applyLegalResearchSafety`.
- **Limite**: mesmo patamar de **sugestão** que o nível 9; **não** promove jurisprudência a “verificada” automaticamente; persistência de pin no caso (`caseBrain.pinnedFoundations`) exige ação humana explícita.

### Nível 10 — Heurística

- **O que é**: regras determinísticas baseadas em features (boost por kind, recência, intent alignment, RRF k=60).
- **No código**: `retrieval/legal/scoring.ts`, `hybrid.ts`, `intent.ts`.
- **Limite**: **influencia ranking**, **não cria conteúdo**; jamais aparece ao usuário como fonte.

### Nível 11 — Fallback LLM

- **O que é**: resposta gerada por LLM **quando** retrieval falha ou tem `groundingScore` baixo.
- **No código**: caminhos com `fallbackFlags` populados; mensagens "base insuficiente" via `source-sufficiency.ts`.
- **Limite**: **nunca** vira fundamento de peça. Exibido apenas como "resposta exploratória" com banner explícito; **bloqueado** para export.

---

## 2. Matriz de capacidade por nível

> Cada `✓` é uma capacidade **permitida**; `✗` é **proibida**; `cond.` é **condicional** com regra explícita na coluna "regra".

| Nível | Pode citar? | Pode fundamentar peça? | Pode sobrescrever outro nível? | Exige validação? | Exige revisão humana? | Pode entrar na memória? | Pode entrar no RAG? | Pode aparecer para cliente? | Pode ser usado no export? | Regra |
|------:|:-----------:|:----------------------:|:------------------------------:|:----------------:|:----------------------:|:------------------------:|:--------------------:|:----------------------------:|:--------------------------:|-------|
| 1 — Legislação oficial vigente | ✓ | ✓ | ✓ (sobrescreve níveis 2-11) | parser oficial + URN-LEX + `validFrom/To` | apenas para inclusão no corpus | ✓ (memória pode referenciar; nunca substitui) | ✓ (`lex_corpus_norms`) | ✓ | ✓ | nível 1 nunca é "estilo"; é texto **vigente na data** |
| 2 — Jurisprudência oficial | ✓ | ✓ | sobrescreve 3-11 (não 1) | fonte oficial + URN ou tribunal verificável | apenas para inclusão | ✓ (apenas referência) | ✓ (`lex_corpus_jurisprudence`) | ✓ | ✓ | citar apenas se `STJ`/`STF`/etc adapter validado |
| 3 — Tribunal/Processo oficial | ✓ (como evidência factual) | cond. | sobrescreve 4-11 quanto a fato processual | login + secret + LGPD | sim p/ live | cond. (eventos podem entrar com PII redigida) | cond. | ✓ (no contexto do próprio cliente) | cond. (anexar como evidência, não como norma) | live exige LGPD doc |
| 4 — Documentos do caso | ✓ (no caso) | cond. (prova fato) | sobrescreve 5-11 quanto a fato do caso | parsing OCR + chunking | sim quando virar fundamento (ApprovedLegalFoundation) | ✗ (nunca para outros casos) | cond. (índice por workspace, não corpus oficial) | cond. (privado ao caso/cliente) | cond. (como documento anexo) | jamais cruza workspace |
| 5 — Fundamentos pinados (`ApprovedLegalFoundation`) | ✓ | ✓ | sobrescreve 6-11 | exige fonte original em 1/2/3 | sim (advogado pinou) | ✓ (escopo workspace) | ✓ (índice de workspace) | ✓ | ✓ | sem fonte original = inválido |
| 6 — Peças aprovadas | cond. (estilo) | ✗ (não como norma) | ✗ | sim (review aprovou) | sim | ✓ (estilo) | cond. (índice de workspace para estilo) | cond. | cond. (como modelo, não como fonte) | reutilizar exige re-validar fundamentos |
| 7 — Memória do escritório (opt-in) | cond. (sugestão) | ✗ | ✗ | opt-in + LGPD + retenção | sim periódica | é a memória | cond. (índice workspace) | cond. (sugestão; nunca como verdade) | ✗ | cruzar workspaces = violação |
| 8 — Modelos / templates internos | cond. (estrutura) | ✗ | ✗ | curadoria interna | sim na curadoria | ✗ (não é memória do escritório) | ✗ (não é corpus jurídico) | ✓ (como guia) | cond. (estrutura, não conteúdo) | texto literal não é fundamento |
| 9 — Inferência IA | cond. (rotulada) | ✗ | ✗ | grounding score + source-sufficiency | sim | ✗ | ✗ | ✓ (rotulada como sugestão) | ✗ (sem ancoragem em 1-5) | sempre rotular como "sugestão IA" |
| 9b — DeepSeek (pesquisa assistida temporária) | ✗ | ✗ | ✗ | avisos + ausência de processNumber | sim | ✗ | ✗ | ✓ (com banner de revisão) | ✗ | pode_citar=NÃO sem confirmação humana; pode_fundar=NÃO; pode_sobrescrever=NÃO |
| 10 — Heurística | ✗ (não aparece) | ✗ | ✗ | benchmark | ✗ | ✗ | ✗ | ✗ | ✗ | nunca exposta ao usuário |
| 11 — Fallback LLM | ✗ | ✗ | ✗ | banner obrigatório | sim quando exibido | ✗ | ✗ | cond. (com banner "base insuficiente") | ✗ (`block-promote`) | jamais entra em peça final |

---

## 3. Regras absolutas (em texto natural)

> Regras que **independem** da matriz e que devem ser ensinadas a todo membro do time, todo agente externo, e implementadas em `drafting-guard`/`source-sufficiency`.

1. **IA nunca é fonte primária de verdade jurídica.** Se o produto exibe "Art. 5º da CF/88 estabelece...", o **chunk de origem** (LegalChunk com `articleRef`) precisa existir, ser vigente em `asOf` e ser referenciado.
2. **Memória do escritório nunca supera legislação/jurisprudência oficial.** Se memória diz "neste tribunal sempre acolhe X" mas norma vigente nega, **prevalece a norma**; memória entra como contexto/sugestão, não como verdade.
3. **Documento do caso pode provar fato, mas não cria norma jurídica.** Se documento diz "o contrato previa X", é prova do **fato contratual**; não cria regra para outros casos.
4. **Peça aprovada pode ensinar estilo, mas não vira verdade jurídica.** Reutilizar peça em novo caso exige **re-validação** dos fundamentos contra níveis 1-3 e re-pinagem em `ApprovedLegalFoundation`.
5. **Jurisprudência só pode ser citada se fonte oficial ou corpus validado.** Para tribunais com adapter em `scaffold` (ex.: STJ hoje), jurisprudência **não** é citada como verdade até promover para `live`.
6. **Base ausente = lacuna, não fundamento.** Se `groundingScore` em "Baixa" e `usedSources.length == 0`, o produto **diz** "não localizei fonte suficiente" e **não inventa**.
7. **Fundamento sem chunk/fonte validada não entra em peça final.** `drafting-guard.ts` + `source-sufficiency.ts` bloqueiam export. Override **proibido** sem assinatura Legal Lead + PO + registro em `OVERRIDES_LOG.md`.
8. **Sugestão IA deve ser rotulada como sugestão.** Componentes de UI exibem badge "Sugestão IA" + Trust UX (origem, score, fontes). Nunca exibir como afirmação.
9. **Toda citação carrega URN-LEX, fullPath, vigência (`validFrom/To`), tribunal (se aplicável) e link para o chunk.** Sem rastreabilidade, citação é proibida.
10. **Norma revogada na data da peça não pode ser usada como fundamento vigente.** Quando a peça exige "vigente em DD/MM/YYYY", o pipeline filtra por `asOf` (já implementado em `bm25.ts`/`dense.ts`).
11. **Conflito entre níveis**: prevalece o **maior** (menor número). Em conflito entre normas no nível 1, prevalece a regra de hierarquia legal (CF > LC > LO > MP > Decreto > Portaria).
12. **Toda mudança neste documento exige RFC + assinatura PO + Legal Lead + CTO.**
13. **Jurisprudência sugerida por DeepSeek sem `processNumber` e sem `sourceUrl` (ou equivalente verificável) jamais é citada em peça final** — permanece “candidata / a conferir” até revisão humana e, quando aplicável, confirmação em fonte oficial.

---

## 4. AI_REASONING ≠ LEGAL_TRUTH

A distinção é canônica e impacta UI/API/contratos:

| Conceito | O que é | Onde aparece no produto | Está sujeito a |
|----------|---------|-------------------------|----------------|
| `LEGAL_TRUTH` | Conteúdo do nível 1 ou 2 (e parcialmente 3) | citações, fundamentos, peça final, export | hierarquia §1, regras §3, gates G-58, S-03 |
| `AI_REASONING` | Síntese, hipótese, sugestão produzida por LLM | painel "Pensar com Lex", brainstorming, próxima ação sugerida, resumo | sempre rotulada; nunca substitui `LEGAL_TRUTH`; bloqueada para export |

**Implicação**: o **mesmo texto** de uma síntese IA, sem referência a chunks de níveis 1-5, **não pode** ser convertido em fundamento por edição manual sem revalidação. Se o usuário tenta "promover" texto IA para fundamento, o sistema deve exigir vinculação a `LegalChunk` ou `ApprovedLegalFoundation`.

---

## 5. Diferença operacional entre as entidades de "fonte"

> Esclarecimento de modelagem porque docs antigos (e até README) ainda confundem essas entidades.

| Entidade | Existe no código? | O que representa | Relacionamento principal | Status |
|----------|-------------------|------------------|----------------------------|--------|
| `LegalSource` | **NÃO** (DROP em migration `20260508130000_drop_legal_source`) | Modelo legacy do RAG anterior | — | **removido**; menções em README são stale (ver Leva 1 §4.2) |
| `LegalNorm` | sim | Norma canônica identificada por URN-LEX | tem N `LegalNormVersion`; tem N `LegalChunk` | nível 1 (legislação) e 2 (jurisprudência) da hierarquia |
| `LegalNormVersion` | sim | Snapshot temporal (vigência) com `validFrom`/`validTo` e `contentHash` | pertence a `LegalNorm`; tem N `LegalChunk` | habilita filtro `asOf` |
| `LegalChunk` | sim | Trecho com hierarquia tipada (Art./§/inciso) e `vectorPointId` no Qdrant | pertence a `LegalNormVersion` | unidade indexada/recuperada |
| `LegalCitation` | sim | Aresta direcionada do grafo (CITES/REVOKES/REGULATES/...) | entre `LegalNorm` | usada em `graph-expansion.ts` |
| `CaseLegalSource` | sim | Vínculo entre `Case` e norma/chunk relevantes para o caso | pertence a `Case`; aponta para `LegalChunk`/`LegalNorm` | curadoria do caso |
| `ApprovedLegalFoundation` | sim (migration `20260509190000_library_foundations`) | Fundamento curado pelo escritório, citável em peças | pertence a `Workspace` | **nível 5 da hierarquia** |
| `Document` / `DocumentChunk` | sim | Documento do caso e seus chunks | pertence a `Case`/`Workspace` | nível 4 |
| `OfficeMemory` | sim (migration `20260509220000_office_memory`) | Memória do escritório (opt-in) | pertence a `Workspace` | nível 7 |
| `InterviewTemplate` | sim | Roteiro de intake | pertence a `Workspace` ou Lex global | nível 8 |

**Regra**: **nada** que esteja em `OfficeMemory`, `Document`, `InterviewTemplate` ou em saída IA pode aparecer como fundamento citável de peça **sem** vínculo a `LegalChunk` (níveis 1/2) ou `ApprovedLegalFoundation` (nível 5, que por sua vez exige fonte em 1/2).

---

## 6. Aplicação operacional

### 6.1 Em `drafting.ts` (geração de peça)

- Aceita apenas chunks com `provenance` em níveis 1-5 como **fontes citáveis**.
- Se `groundingScore` < `Q-B-01` threshold ou `usedSources.length == 0`, **não gera peça**: gera lacuna explícita ("Não localizei fonte suficiente para fundamentar X — pinare ou pesquise mais").
- Marca todo trecho gerado por LLM como `AI_REASONING`; só promove a `LEGAL_TRUTH` quando ancorado a chunk válido.

### 6.2 Em `review.ts` (revisão)

- Item da checklist: **toda citação tem URN + chunkId + vigência válida**? Se não, `verdict = REJECTED`.

### 6.3 Em export DOCX/PDF

- Bloqueio se algum item exibido como fundamento estiver em níveis 6-11 sem ancoragem em 1-5.
- Trust UX renderizado: badge "Origem: nível 1 — Constituição Federal/88, Art. 5º, II".

### 6.4 Em UI (Trust UX)

- Cada citação mostra: nível (badge), URN-LEX, `fullPath`, vigência, tribunal (se aplicável), score.
- Sugestões IA (nível 9) sempre com badge "Sugestão IA" + opção "ver fonte".
- Fallback (nível 11) sempre com banner "base insuficiente — esta resposta é exploratória; não use como fundamento".

### 6.5 Em RAG / corpus

- Apenas níveis 1 e 2 entram no `lex_corpus_norms` / `lex_corpus_jurisprudence`.
- Documentos do caso (nível 4) e memória (nível 7) vão para índices separados, **escopados por workspace** (nunca cruzam).
- ApprovedLegalFoundation (nível 5) referencia chunks dos níveis 1/2; não duplica corpus.

---

## 7. Casos de borda explícitos

| Cenário | Tratamento |
|---------|------------|
| Norma editada hoje publicada no DOU mas ainda não indexada | nível 1 quando indexada; até lá, lacuna explícita; nunca "achismo" |
| Acórdão recente STF não disponível em RSS oficial | tratar como nível 9 com link externo "ver fonte oficial"; **não** virar fundamento |
| Documento do caso menciona "lei estadual X" não indexada | nível 4 prova que o caso **menciona**; nível 1 só após indexar a lei estadual |
| Memória do escritório aprendeu "neste juízo evitar pedido de tutela com base em X" | nível 7 sugere; **não** vira norma; aparece como sugestão estratégica |
| LLM gera "interpretação majoritária da doutrina é Y" sem fonte | nível 9; bloqueado para fundamento; UX deve traduzir para lacuna |
| Peça aprovada antiga citava norma hoje revogada | reuso exige revalidação; nível 6 ensina estrutura, não conteúdo |
| Cliente solicita peça com base em legislação estrangeira | fora do escopo do corpus brasileiro; tratar como lacuna; lembrete na UI |

---

## 8. Métricas associadas (cross-ref `QUALITY_THRESHOLDS.md`)

- **Source existence (Q-B-05)** = 100% — **regra dura** desta hierarquia.
- **Citation accuracy (Q-B-04)** alinhada à matriz §2 (citação só para níveis 1-5 com chunk válido).
- **Hallucination rate (Q-C-01)** monitorada por revisão jurídica amostral.
- **Wrong article rate (Q-C-03)** mede violação direta da hierarquia.
- **Normative mismatch (Q-C-05)** mede uso de norma não-vigente em `asOf`.

---

## 9. Override

Override **proibido** para:

- Permitir nível 9/11 como fundamento citável.
- Permitir cruzamento de memória entre workspaces.
- Permitir export sem ancoragem em níveis 1-5.

Override **possível** (com restrições) para:

- Promover provider de jurisprudência (ex.: STJ) de scaffold para nível 2: exige RFC + adapter live + benchmark + assinaturas Legal Lead + retrieval owner + CTO.
- Indexar norma não-publicada em fonte oficial (ex.: lei municipal apenas em PDF da prefeitura): exige RFC + Legal Lead + curadoria + flag explícita "não-oficial".

Override frequente (≥3/trimestre da mesma regra) dispara revisão da regra.

---

## 10. Como aplicar este doc

1. **Hoje**: este doc é canônico. Toda mudança em retrieval/drafting/review/UX consulta a matriz §2.
2. **F0**: auditoria de todas as superfícies (UI, APIs, exports) confirmando que cada exibição de "fonte" carrega `nível + URN + chunk + vigência`.
3. **F1**: instrumentar Trust UX para badges de nível em todas as citações.
4. **F2**: legal-quality-engine automatiza checagens (citation accuracy, source existence, normative mismatch).

---

## 11. Anti-padrões proibidos

- "A IA disse, então é fonte" → proibido.
- "A peça antiga usou esse fundamento, então pode" → proibido sem revalidação.
- "Memória do escritório acumulou esse padrão, então é regra" → proibido.
- "Vamos exportar mesmo sem fonte porque o usuário pediu" → proibido (gate G-58 + S-03).
- "Fallback LLM dá uma boa resposta exploratória, vamos deixar virar peça" → proibido.

---

## Veja também

- [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md), [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md), [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md), [`BENCHMARK_STRATEGY.md`](BENCHMARK_STRATEGY.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md).
