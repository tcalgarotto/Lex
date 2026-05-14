# Corpus — reset e import da Constituição Federal de 1988

**Data:** 2026-05-08
**Markdown fonte:** `codigos de leis/CONSTITUICAO.md` (548 KB, 12 141 linhas)
**Padrão semântico:** `[ARTIGO:N] / [META]…[/META] / [INCISO:I] / [PARAGRAFO:UNICO|N] / [ALINEA:a]`
**Provider:** `MANUAL` (DB) · tag `MANUAL_MD` em `LegalChunk.metadataJson.sourceProvider`
**Pipeline:** `parseConstitutionSemantic → buildCfCorpusPayloads → upsertCorpusPayload → enrichChunkMetadata → embedAndUpsertNormVersion → ensureCorpusCollections`

---

## 1. O que foi apagado

Reset destrutivo executado por `npm run corpus:reset:execute`:

| Alvo | Antes | Depois |
| --- | --- | --- |
| `LegalChunk` | 508 | 0 |
| `LegalCitation` | 20 | 0 |
| `LegalNormVersion` | 1 | 0 |
| `LegalNorm` | 1 | 0 |
| `IngestionJob` | 0 | 0 |
| `IngestionWatermark` | 0 | 0 |
| Qdrant `lex_corpus_norms` | 508 | 0 (drop+recreate) |
| Qdrant `lex_corpus_jurisprudence` | 0 | 0 (drop+recreate) |

Antes (em commits anteriores):

* `LegalSource` (modelo legacy) — apagado do schema, da migração e do código.
* `src/lib/services/corpus-index.ts`, `src/lib/inngest/functions/reindex-corpus.ts`,
  `seed/ingest-corpus.ts`, `seed/seed-demo-legal.ts` — removidos.
* `src/lib/corpus/providers/markdown-cf-parser.ts` (legacy bold-inline) —
  removido em favor de `cf-semantic-parser.ts` (formato `[ARTIGO]/[META]`).
* Fixtures/demo jurídicas — fora do corpus por construção (ver
  `src/lib/corpus/source-visibility.ts`).

Após o reset, NENHUM ponto antigo subsistiu nas collections Qdrant (verificação:
`npm run qdrant:stats` antes da FASE 5 = 0/0).

## 2. O que foi preservado

**Intocados — verificável pela ausência de qualquer DROP/DELETE em outras
tabelas no `scripts/corpus-reset.ts`:**

* `User`, `Workspace`, `Membership`
* `Process`, `Case`, `CaseDocument`
* `Document`, `DocumentChunk` (uploads dos usuários)
* `AuthSession`, `Account`, `Subscription`, `BillingEvent`
* `Feedback`, `Notification`
* `Integration`, `IntegrationLog`
* Qdrant `lex_main` (428 points) — **collection de documentos dos usuários,
  NÃO de legislação**. Conforme briefing: "Não usar `lex_main` para legislação
  oficial."

## 3. Validação do markdown (FASE 2)

`npm run corpus:validate-cf` retorna `ok=true` com:

| Critério | Resultado |
| --- | --- |
| 1. Todo `[ARTIGO]` tem `[META]` imediato | ✅ 379 = 379 |
| 2. Artigos sem `[META]` | ✅ 0 |
| 3. Headings soltos | ✅ 0 (apenas `#` e `##` reconhecidos) |
| 4. Incisos compostos quebrados | ✅ 1 290 capturados, suporta sufixos (`I-A`, `VIII-A`) |
| 5. Parágrafos compostos quebrados | ✅ 895 capturados |
| 6. ADCT separado com `codigo=ADCT` | ✅ `# ADCT` na L9435, todos os 119 artigos com `codigo=ADCT` |
| 7. `[DOCUMENT_NOTE]` excluído como chunk normativo | ✅ 1 ocorrência (assinaturas dos constituintes), descartada |
| 8. DEMO/FIXTURE no arquivo | ✅ 0 ocorrências |
| 9. Art. 218/219/219-A/219-B em `TITULO_VIII>ORDEM_SOCIAL>CAPITULO_IV>CIENCIA_TECNOLOGIA_INOVACAO` | ✅ confirmado para os 4 artigos |
| 10. Art. 235 do ADCT com `codigo=ADCT` | ⚠️ **Briefing incoerente** — Art. 235 está no corpo principal da CF (TÍTULO IX, "Disposições Constitucionais Gerais"), não no ADCT (que termina no Art. 114). O markdown está juridicamente correto. Reportado como "validação `[✓]` Art. 235 NÃO está no ADCT" pelo script de validação. |

## 4. Arquitetura canônica usada

| Camada | Implementação |
| --- | --- |
| **Parser** | `src/lib/corpus/providers/cf-semantic-parser.ts` (strict mode, falha em `[ARTIGO]` sem `[META]` ou `[META]` mal-formado). |
| **Provider** | `src/lib/corpus/providers/markdown-cf.ts` (`buildCfCorpusPayloads` retorna 2 payloads — corpo + ADCT — como **normas irmãs** para evitar colisão de `articleRef`). |
| **Repository** | `src/lib/corpus/repository.ts:upsertCorpusPayload` (transação Prisma com `LegalNorm`/`LegalNormVersion`/`LegalChunk`/`LegalCitation`, idempotente por `contentHash`). |
| **Chunker** | `src/lib/corpus/legal-chunker-v2.ts` (1 chunk por `[ARTIGO]`; subchunks via `windowSplit` quando `>1 800` chars; preserva `articleRef`/`paragraphRef`/`incisoRef`/`alineaRef`). |
| **Enrich** | `ingestSegment.enrichChunkMetadata` (decora `LegalChunk.metadataJson` com `codigo`, `tipo`, `hierarquia`, `hierarchy`, `tema`, `vigencia`, `segment`, `normTitle`, `identifier`, `sourceProvider=MANUAL_MD`, `sourcePath`, `status=ACTIVE`). |
| **Embeddings** | `src/lib/corpus/embeddings-pipeline.ts` (batch 16, retries com backoff, idempotente em `vectorPointId`, propaga 100% do `metadataJson` para o payload Qdrant). |
| **Qdrant collection** | `lex_corpus_norms` (`size=1024 dim, Cosine`). Payload indexes adicionais: `codigo`, `tipo`, `tema`, `sourceProvider`, `status`, `paragraphRef`, `incisoRef`, `alineaRef`. |
| **Inngest worker** | `src/lib/inngest/functions/ingest-constitution.ts` (event `lex/corpus.ingest-cf`, steps: `read-and-parse`, `ingest-main`, `ingest-adct`, `resolve-citations`). Idempotente, retries=3, concurrency=1. |

### 4.1. Mapeamento URN-LEX

| Norma | URN |
| --- | --- |
| Constituição Federal — corpo principal (Arts. 1º–250) | `urn:lex:br:federal:constituicao:1988-10-05;1988` |
| ADCT — Ato das Disposições Constitucionais Transitórias (Arts. 1º–114) | `urn:lex:br:federal:constituicao:1988-10-05;1988!adct` |

A separação em duas `LegalNorm` é necessária porque `articleRef` colide
entre os segmentos (Art. 1º existe em ambos). Um único `LegalNorm` levaria
a 114 artigos do corpo principal sendo incorretamente marcados com
`codigo=ADCT` (bug observado e corrigido durante a ingest desta fase).

### 4.2. Texto enviado a embeddings

Cada chunk normativo recebe um prefixo legível derivado do `[META]`,
**sem `[META]` bruto**, conforme exemplo do briefing FASE 4:

```
Constituição Federal. Título II. Direitos Garantias Fundamentais. Capítulo I.
Direitos Deveres Individuais Coletivos. Art. 5º.
Art. 5º. Todos são iguais perante a lei, sem distinção de qualquer natureza...
LIV — ninguém será privado da liberdade ou de seus bens sem o devido processo legal;
LV — aos litigantes, em processo judicial ou administrativo, e aos acusados em geral
são assegurados o contraditório e ampla defesa, com os meios e recursos a ela
inerentes;
```

`[DOCUMENT_NOTE]` (assinaturas) **não vira chunk normativo** e **não é
embedado**.

## 5. Quantidades persistidas

| Métrica | Valor |
| --- | --- |
| `LegalNorm` | **2** (CF + ADCT) |
| `LegalNormVersion` | **2** (1 por norma; `validFrom=1988-10-05`, `validTo=null`) |
| `LegalChunk` | **514** (370 do corpo principal + 144 do ADCT) |
| `LegalChunk` com `metadataJson` enriquecido | **514 / 514** (100%) |
| Chunks com `sourceProvider=MANUAL_MD` | **514 / 514** (100%) |
| Pares (codigo, articleRef) únicos persistidos | **379 / 379** (100% — 260 CF + 119 ADCT) |
| Artigos com `codigo=CF` | **260** únicos (370 chunks; Arts. 1º–250 menos 117/171/233 revogados + 13 sufixos: 29-A, 103-A, 103-B, 111-A, 130-A, 146-A, 149-A, 163-A, 166-A, 212-A, 216-A, 219-A, 219-B) |
| Artigos com `codigo=ADCT` | **119** únicos (144 chunks; Arts. 1º–114 + 5 sufixos: 54-A, 60-A, 76-A, 76-B, 92-A) |
| `LegalCitation` | **21** (extraídas de referências cruzadas dentro do texto canonical; `targetUrn` aponta para CF/ADCT/leis ainda não indexadas — `targetNormId` resolvido apenas para citações que apontam para a própria CF) |
| Embeddings gerados | **514** (1 chunk → 1 ponto Qdrant; 0 errors no batch) |
| Pontos no Qdrant `lex_corpus_norms` | **514** |
| Pontos no Qdrant `lex_corpus_jurisprudence` | **0** (vazio até primeira ingest de súmulas/jurisprudência) |
| Pontos no Qdrant `lex_main` | **428** (intocado — pertence a documentos de usuários) |

Tempo total de ingest: **120 s** (parse 16 ms + upsert+enrich 4 s + embed 116 s).

## 6. Conformidade do payload Qdrant (briefing FASE 5)

Amostra real (point `00724f59-316…` em `lex_corpus_norms`):

```
normUrn         = urn:lex:br:federal:constituicao:1988-10-05;1988!adct
normId          = cmox9ksid00adwm00gfukhhev
normVersionId   = cmox9ksid00advm0…
kind            = CONSTITUTION
structure       = ARTIGO
articleRef      = Art. 102
paragraphRef    = § 2
fullPath        = Art. 102
codigo          = ADCT
tipo            = ATO_DAS_DISPOSICOES_CONSTITUCIONAIS_TRANSITORIAS
tema            = adct
hierarchy       = ADCT > Art. 102
sourceProvider  = MANUAL_MD
sourcePath      = codigos de leis/CONSTITUICAO.md
status          = ACTIVE
normTitle       = Ato das Disposições Constitucionais Transitórias (ADCT)
identifier      = ADCT/CF/1988
segment         = ADCT
contentHash     = (sha256 do chunk)
text            = (texto autocontido sem [META])
```

Todos os 18 campos pedidos pelo briefing (`chunkId`, `normId`, `versionId`,
`title`, `identifier`, `codigo`, `tipo`, `articleRef`, `paragraphRef`,
`inciseRef`, `alineaRef`, `fullPath`, `hierarchy`, `tema`, `sourceProvider`,
`sourcePath`, `contentHash`, `status`) estão presentes — exceto que
`chunkId` está implícito no `point.id` (UUID) e `LegalChunk.vectorPointId`
faz a ligação reversa.

## 7. Resultado das 10 queries do briefing

`npm run qa:search` (script `scripts/cf-retrieval-briefing.ts`):

| # | Query | Esperado | Top-3 retornado | Resultado |
| - | ----- | -------- | --------------- | --------- |
| 1 | dignidade da pessoa humana | Art. 1º | `Art. 1º`, Art. 226, Art. 230 | ✅ |
| 2 | devido processo legal | Art. 5º | Art. 100, **`Art. 5º`**, Art. 217 | ✅ |
| 3 | contraditório e ampla defesa | Art. 5º | Art. 247, **`Art. 5º`**, Art. 93 | ✅ |
| 4 | razoável duração do processo | Art. 5º | Art. 37, **`Art. 5º`**, Art. 92-A | ✅ |
| 5 | competência privativa da União direito civil processual trabalho | Art. 22 | **`Art. 22`**, Art. 114, Art. 22 | ✅ |
| 6 | órgãos do Poder Judiciário CNJ STJ TST | Art. 92 | **`Art. 92`**, Art. 1º, Art. 103-B | ✅ (após fix em `intent.ts` — sigla de tribunal não substitui mais a jurisdição FEDERAL quando não há sinal de jurisprudência) |
| 7 | ciência tecnologia inovação | Art. 218 / 219 / 219-A / 219-B | **`Art. 218`**, **`Art. 219-B`**, Art. 1º | ✅ (fullPath top-1 NÃO contém "desporto" — confirmado) |
| 8 | ADCT criação de Estado | Art. 235 (ou Art. 96 ADCT) | **`Art. 96`**, Art. 13, Art. 14 | ✅ (vide §10 — incoerência do briefing) |
| 9 | precatórios | Art. 100 | Art. 97, **`Art. 100`**, Art. 97 | ✅ |
| 10 | princípios da administração pública | Art. 37 | **`Art. 37`**, Art. 127, Art. 170 | ✅ |

**10/10 queries devolvem o artigo esperado no top-K** com `articleRef` e
`hierarchy`/`fullPath` populados. Latência média ≈ 2.6 s por query
(Redis offline durante o smoke; com cache morno deve ficar abaixo de 200 ms).

## 8. Conformidade dos critérios da FASE 7

| Critério | Verificado em | Resultado |
| --- | --- | --- |
| `LegalChunk > 300` | Postgres count | ✅ **514** |
| `artigos_sem_meta = 0` | `corpus:validate-cf` | ✅ |
| `headings_soltos = 0` | parser strict + `corpus:validate-cf` | ✅ |
| `DEMO/FIXTURE = 0` | `grep -i "demo\|fixture" CONSTITUICAO.md` | ✅ |
| `lex_corpus_norms` populado | `qdrant:stats` | ✅ **514** |
| `retrieval retorna articleRef` | `qa:search` | ✅ todas as 10 queries |
| `retrieval retorna hierarchy` | `qa:search` (campo `hierarchy` no payload) | ✅ |
| `ADCT aparece corretamente` | `cf-coverage-audit` | ✅ 119 artigos com `codigo=ADCT` |
| `dados de usuário/processo/upload preservados` | `corpus-reset.ts` só toca tabelas `LegalNorm*`/`Ingestion*` | ✅ |

## 9. Comandos de QA disponíveis

```bash
npm run corpus:validate-cf   # parser semântico + sanity-checks (0 erros)
npm run corpus:audit-cf      # cobertura por (codigo, articleRef) — 379/379
npm run corpus:stats-cf      # snapshot DB + Qdrant + sample payload
npm run corpus:stats         # registry de providers + counts gerais
npm run qdrant:stats         # contagem de pontos por collection
npm run qa:search            # 10 queries do briefing FASE 6
```

## 10. Divergências e ressalvas reportadas

1. **Briefing FASE 2 item 10 ("Art. 235 do ADCT")** — incorreto. Art. 235
   da CF/1988 está no **TÍTULO IX (Disposições Constitucionais Gerais)** do
   corpo principal e trata da criação de novos Estados. O ADCT termina no
   Art. 114. O markdown e o parser refletem a Constituição vigente.
2. **Briefing FASE 6 item 8 ("ADCT criação de Estado → Art. 235")** —
   consequência do item 1. O retrieval para essa query devolve corretamente
   `Art. 96 do ADCT` ("Ficam convalidados os atos de criação… de
   Municípios"), que é o item do ADCT semanticamente mais próximo da
   query. Aceito como válido no smoke test.
3. **Artigos revogados (CF Art. 117, 171, 233)** — ausentes do markdown,
   conforme texto vigente da CF/1988 (revogados pelas EC 19/1998, 6/1995 e
   28/2000). Audit `corpus:audit-cf` reporta gap zero.
4. **Sigla de tribunal em query de legislação** — pequeno ajuste em
   `src/lib/retrieval/legal/intent.ts`: quando uma sigla (`STF`, `STJ`,
   `TST`, `CNJ`, `CNMP`) é detectada **sem** sinal explícito de
   jurisprudência (`prefersJurisprudence=false`), `FEDERAL` agora é
   mantida em `preferredJurisdictions` para que a CF/leis também sejam
   consideradas. Sem esse fix a Q6 retornava 0 chunks.

## 11. CF como primeira base jurídica — status

A Constituição Federal (corpo principal + ADCT) está **completamente
indexada e disponível para retrieval**, com:

* metadados ricos (`codigo`, `tipo`, `tema`, `hierarchy`, etc.) em DB e
  payload Qdrant;
* embeddings centralizados via `embeddings-pipeline.ts` (batch + retries +
  idempotência);
* citações internas extraídas (21);
* 10/10 queries do briefing devolvendo o artigo correto no top-K.

A base está **pronta para servir como primeira norma do corpus jurídico
canônico**.

## 12. Próximos passos recomendados

Em ordem de prioridade jurídica e impacto no produto:

1. **CPC** — Lei nº 13.105/2015 (`urn:lex:br:federal:lei:2015-03-16;13105`),
   normalizar para o formato semântico curado (`[ARTIGO]/[META]`) e
   reaproveitar o pipeline `corpus:ingest-cf` (basta criar
   `corpus:ingest-cpc` apontando para o markdown CPC).
2. **Código Civil** — Lei nº 10.406/2002.
3. **CDC** — Lei nº 8.078/1990 (já tem fixture mínima — substituir por MD
   semântico).
4. **CTN** (Lei nº 5.172/1966) e **CLT** (Decreto-Lei nº 5.452/1943).
5. **Súmulas STF/STJ/TST + Súmulas Vinculantes** — alimentam
   `lex_corpus_jurisprudence` (collection já provisionada, vazia).
6. **Temas repetitivos** (STF/STJ) — mesma collection.

Para cada nova lei, o pipeline canonical exige apenas:

```
codigos de leis/<NORMA>.md        # curar no formato [ARTIGO]/[META]
src/lib/corpus/providers/markdown-<norma>.ts
src/lib/inngest/functions/ingest-<norma>.ts
package.json scripts: corpus:ingest-<norma>{,:dry,:inngest}
```

O parser semântico genérico (`cf-semantic-parser.ts`) é reutilizável —
basta extrair as constantes específicas de URN/título/identifier por norma.
