# Snapshot — Pré-expansão de corpus oficial e DataJud

> Captura do estado em produção (`https://lex-navy.vercel.app`) imediatamente
> antes da expansão Sul/Sudeste + Planalto + jurisprudência superior + DataJud.
> Branch de trabalho: `corpus/official-south-southeast-datajud`.
> Data: 2026-05-08.

## Health checks

```
GET /api/ready  → 200 ok
GET /api/health → status=ok
  db        ok (latency 692ms)
  redis     ok (Upstash, TLS, pong)
  qdrant    ok
  supabase  ok
  inngest   ok (eventKey + signingKey presentes)
```

## Postgres (corpus)

| modelo | count | nota |
|---|---:|---|
| `LegalNorm` | 7 | CF/1988, CPC, CC, CDC, LMP, EAOAB + Súmula Vinculante 14 (FIXTURE legacy) |
| `LegalNormVersion` | 7 | uma por norma |
| `LegalChunk` | 23 | dos quais **22 são `MANUAL`** (corpus mínimo verificado) e 1 do FIXTURE legacy |
| `LegalCitation` | 3 | grafo mínimo |
| `Document` | 3 | uploads de usuário |
| `DocumentChunk` | 48 | pipeline Inngest funcionando |
| `LegalSource` (legacy) | 11 | **3 DEMO ainda visíveis** ❌ |

## DEMO ainda presente em produção (FASE 1 — bloqueador)

`LegalSource` legacy mantém 3 entradas com `code` contendo `DEMO`:

```
STF-RE-DEMO-1     | jurisprudence | STF | Controle de constitucionalidade
STJ-RESP-DEMO-1   | jurisprudence | STJ | Responsabilidade civil
STJ-AGR-DEMO-1    | jurisprudence | STJ | Tempestividade recursal
```

`LegalNorm` ainda tem 1 entrada `FIXTURE`:

```
urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14
"Súmula Vinculante 14" (Provider=FIXTURE)
```

## Qdrant

| collection | points | vectors | status |
|---|---:|---:|---|
| `lex_main` | 428 | 0 | green (legacy: uploads + LegalSource) |
| `lex_corpus_norms` | **22** | 0 | green (corpus oficial mínimo) |
| `lex_corpus_jurisprudence` | **0** | 0 | green — **vazia** |

## Provider registry

| id | status | mode | obs |
|---|---|---|---|
| LEXML | ok | live | SRU/XML pronto |
| STF | ok | live | súmulas + súmulas vinculantes |
| STJ | ok | live | SCON |
| CAMARA | ok | live | dados abertos |
| SENADO | ok | live | dados abertos |
| FIXTURE | ok | fixture | usado só para testes |
| **DATAJUD** | **not_configured** | live | falta `DATAJUD_API_KEY` no ambiente atual |

## Códigos críticos no DB

| código | presente? | provider |
|---|---|---|
| Constituição Federal | ✔ | MANUAL |
| Código de Processo Civil (Lei 13.105/2015) | ✔ | MANUAL |
| Código Civil (Lei 10.406/2002) | ✔ | MANUAL |
| Código de Defesa do Consumidor (Lei 8.078/1990) | ✔ | MANUAL |
| Lei Maria da Penha (Lei 11.340/2006) | ✔ | MANUAL |
| Estatuto da Advocacia (Lei 8.906/1994) | ✔ | MANUAL |

> **Importante:** Lei Maria da Penha **existe** no DB. Se a busca por
> "lei maria da penha" não a encontra, o problema está no pipeline de
> retrieval/sanitização ou no chunker (LMP tem só 1 chunk; é insuficiente
> para casamento por palavra-chave). FASE 1+7 endereçam isso.

## Tribunais Sul/Sudeste

Registry atual (`src/lib/corpus/tribunals/registry.ts`) precisa ser auditado e
expandido (FASE 6) para garantir cobertura de TJSP, TJRJ, TJMG, TJES, TJRS,
TJSC, TJPR, TRF2/3/4/6, TRT1/2/3/4/9/12/15/17 e TREs respectivos.

## Critérios MVP atuais (npm run qa:production)

```
✔ inngest-security
✔ bundle-safety
✔ db-document            Document=3  DocumentChunk=48
✔ db-document-chunks-empty
✔ legal-norms-min        LegalNorm=7 (mínimo 6)
✔ legal-chunks-min       LegalChunk=23 (mínimo 20). MANUAL=22
✔ qdrant-corpus-norms    lex_corpus_norms: 22 points
✔ http-health            status=ok
✔ http-search-clean      auth gate ativo (HTTP 401)
```

Mínimos atuais são **muito baixos** (6 normas, 20 chunks). FASE 10 vai elevar
para os critérios profissionais (≥12 normas, ≥100 chunks, LMP/CPC/CDC/CC
testáveis, sem DEMO).

## Plano por fases (próximas iterações)

1. FASE 1 — purgar DEMO da experiência normal (helper + filtros + testes).
2. FASE 2 — importador Planalto + catálogo 15 leis.
3. FASE 3 — LexML como catálogo/metadados.
4. FASE 4 — jurisprudência superior (súmulas STF/STJ/TST/TSE).
5. FASE 5 — DataJud (movimentações Sul/Sudeste).
6. FASE 6 — tribunal registry Sul/Sudeste.
7. FASE 7 — busca/biblioteca profissional.
8. FASE 8 — Strategy/Cases com fontes reais.
9. FASE 9 — cockpit honesto com DataJud.
10. FASE 10 — QA atualizado.
11. FASE 11 — limites e segurança.
12. FASE 12 — documentação.
13. FASE 13/14 — testes completos.
14. FASE 15 — deploy + relatório final.

Cada fase: commit isolado, testes verdes, diff explicado.
