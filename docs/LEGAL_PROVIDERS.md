# Lex — Provedores Jurídicos (corpus RAG)

> Mapa canônico do que cada provider alimenta, qual chave precisa, e como
> ativá-lo. Atualizado para a nova arquitetura com `registry.ts`, modos
> `live | fixture | disabled`, rate-limit cooperativo e scripts dedicados.

---

## Quadro resumo

| Provider | Chave? | Cobertura | Collection no Qdrant | Status default em prod |
|---|---|---|---|---|
| **`FIXTURE`** | não | CDC, CC, CPC, CF/88, súmula demo | depende do `kind` | sempre `ok` |
| **`LEXML`** | não — SRU/XML público | **Vade mecum federal** completo (legislação federal, estadual, EC, decretos) | `lex_corpus_norms` | `live` |
| **`STF`** | não — HTML público | Súmulas + Súmulas Vinculantes | `lex_corpus_jurisprudence` | `live` |
| **`STJ`** | não — SCON público | Súmulas (acórdãos via plug-in extractor) | `lex_corpus_jurisprudence` | `live` |
| **`DATAJUD`** | **sim — `DATAJUD_API_KEY` (CNJ)** | **91 tribunais** (4 superiores + 27 TJs + 6 TRFs + 24 TRTs + 27 TREs + 3 TJMs) | `lex_corpus_jurisprudence` (process_metadata) | `live` (status `not_configured` enquanto faltar chave) |
| **`CAMARA`** | não — REST/JSON público | Proposições legislativas (PL, PEC, MPV...) | `lex_corpus_norms` (legislative_proposals) | `live` |
| **`SENADO`** | não — REST/JSON público | Matérias legislativas (PL, PEC, PLS, PLN...) | `lex_corpus_norms` (legislative_proposals) | `live` |

> O roteamento Qdrant é automático — `collectionForKind(kind)` em `src/lib/corpus/qdrant-collections.ts` decide.

---

## Modos por provider

Cada provider aceita 3 modos via env `<PROVIDER>_PROVIDER_MODE`:

- `live`     — usa fonte real (HTTP), com rate-limit + retry + timeout
- `fixture`  — usa dataset embutido (zero rede)
- `disabled` — provider rejeita qualquer chamada (`NonRetriableError`)

Em **produção** o default é **tudo `live`**:

```env
LEXML_PROVIDER_MODE=live
STF_PROVIDER_MODE=live
STJ_PROVIDER_MODE=live
DATAJUD_PROVIDER_MODE=live      # exige DATAJUD_API_KEY
CAMARA_PROVIDER_MODE=live
SENADO_PROVIDER_MODE=live
```

Sem `DATAJUD_API_KEY` o provider DataJud entra em **`not_configured`**:
o build, o deploy e o `/api/health` continuam saudáveis; apenas as
chamadas a esse provider falham com `NonRetriableError` claro até a
chave ser preenchida.

Em **preview** mantenha `fixture` para evitar martelar APIs públicas a cada PR.

---

## Onde pegar cada coisa

### LexML
- Endpoint público SRU: `https://www.lexml.gov.br/busca/SRU`
- Sem chave. Sem registro. Sem termos restritivos para uso documental.
- **Rate-limit recomendado**: 20 req/min (default). Cooperativo via `acquireProviderSlot`.

### STF
- Portal público: `https://portal.stf.jus.br`
- IDs de Súmula Vinculante são estáveis (1..62 atualmente). IDs de Súmulas idem.
- Rate-limit recomendado: **10 req/min** (conservador).

### STJ
- SCON: `https://scon.stj.jus.br`
- Rate-limit recomendado: **10 req/min**.
- Para acórdãos completos, plugue um `StjExtractor` customizado (interface `extractor` no construtor).

### DataJud
- Wiki oficial: <https://datajud-wiki.cnj.jus.br/api-publica/acesso>
- Chave gratuita: preencha o formulário do CNJ → recebe key por email em poucos minutos.
- Endpoints por alias: <https://datajud-wiki.cnj.jus.br/api-publica/endpoints>
- Lista canônica dos **91 aliases** no Lex: `src/lib/corpus/providers/datajud-aliases.ts`.

### Câmara dos Deputados
- API pública REST/JSON: `https://dadosabertos.camara.leg.br/api/v2`
- Sem chave. Sem registro. Endpoints usados: `/proposicoes`, `/proposicoes/{id}`.
- Rate-limit recomendado: **30 req/min** (default).

### Senado Federal
- API pública REST/JSON (com `Accept: application/json`): `https://legis.senado.leg.br/dadosabertos`
- Sem chave. Endpoints usados: `/materia/pesquisa/lista?ano=YYYY`, `/materia/{codigo}`.
- Rate-limit recomendado: **30 req/min** (default).

---

## Aliases DataJud (91 tribunais, oficial CNJ)

| Categoria | Quantidade | Exemplos |
|---|---|---|
| Superiores | 4 | `api_publica_stj`, `api_publica_tst`, `api_publica_tse`, `api_publica_stm` |
| TRFs | 6 | `api_publica_trf1` … `api_publica_trf6` |
| TJs estaduais | 27 | `api_publica_tjsp`, `api_publica_tjrj`, `api_publica_tjmg`, `api_publica_tjdft`, … |
| TRTs | 24 | `api_publica_trt1` … `api_publica_trt24` |
| TREs | 27 | `api_publica_tresp`, `api_publica_trers`, `api_publica_trepr`, … |
| TJMs estaduais | 3 | `api_publica_tjmmg`, `api_publica_tjmrs`, `api_publica_tjmsp` |

> **STF NÃO está no DataJud** — tem portal próprio (coberto pelo provider `STF` do Lex).

A lista completa, com `priority`, `category` e `label`, está em
`src/lib/corpus/providers/datajud-aliases.ts`. Helpers exportados:

```ts
import {
  DATAJUD_ALIASES,
  DATAJUD_ALIAS_TOTALS,
  listPriorityAliases,
  aliasesByCategory,
} from "@/lib/corpus/providers/datajud-aliases";
```

---

## Como verificar status

```bash
# Snapshot do registry (mostra cada provider e por que está ok/disabled/not_configured)
npm run corpus:stats

# Diagnóstico específico do DataJud (testa chave + alias)
npm run datajud:check
npm run datajud:dry-run    # constrói query mas não envia
```

Em prod: `GET /api/admin/corpus-stats` (apenas OWNER).
Health: `GET /api/health` agora inclui o array `providers[]`.

---

## Como popular o corpus

Ver `docs/CORPUS_SEEDING.md` para o passo-a-passo completo.

Resumo:

```bash
# 1. Bootstrap rápido (fixtures)
npm run corpus:seed:fixture

# 2. Vade mecum federal
npm run corpus:seed:lexml -- --max-pages=20

# 3. Súmulas STF/STJ
npm run corpus:seed:stf
npm run corpus:seed:stj

# 4. (Quando tiver chave) DataJud
npm run datajud:check
npm run corpus:sync -- --provider=DATAJUD --max-pages=2

# 5. Câmara dos Deputados (proposições) — sem chave
npm run corpus:sync -- --provider=CAMARA --max-pages=5

# 6. Senado Federal (matérias) — sem chave
npm run corpus:sync -- --provider=SENADO --max-pages=5
```

---

## Comportamento sem credenciais

Critério-mestre: **falta de chave nunca quebra build, deploy, health ou runtime**.

| Cenário | Comportamento |
|---|---|
| `DATAJUD_API_KEY` ausente | DataJud → status `not_configured`, scripts dry-run funcionam, jobs Inngest lançam `NonRetriableError` claro |
| `LEXML_PROVIDER_MODE=fixture` | LexML usa fixtures embutidas |
| `STF_PROVIDER_MODE=disabled` | STF rejeita, mas health permanece ok |
| Todos disabled | `corpus:seed:all-public` pula tudo, sem erro |

---

## Adicionando um provider novo

1. Implemente `CorpusProviderClient` em `src/lib/corpus/providers/<nome>.ts`.
2. Adicione um `CorpusProviderEntry` em `src/lib/corpus/providers/registry.ts`:
   - `status()` decide quando aparecer ok/disabled/not_configured
   - `factory()` constrói a instância
3. Adicione envs novas em `src/lib/env.ts` (Zod) + `.env.example`.
4. Atualize este arquivo + `docs/CORPUS_SEEDING.md`.
5. Escreva testes em `<nome>.test.ts`.
