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
| **`DATAJUD`** | **sim — `DATAJUD_API_KEY` (CNJ)** | Movimentações processuais de TJs/TRFs/TRTs/TST/TSE/STJ/STF | `lex_corpus_jurisprudence` (process_metadata) | `disabled` (até chave existir) |
| **`CAMARA`** (stub) | não | Proposições legislativas | n/d (planejado) | `disabled` |
| **`SENADO`** (stub) | não | Matérias legislativas | n/d (planejado) | `disabled` |

> O roteamento Qdrant é automático — `collectionForKind(kind)` em `src/lib/corpus/qdrant-collections.ts` decide.

---

## Modos por provider

Cada provider aceita 3 modos via env `<PROVIDER>_PROVIDER_MODE`:

- `live`     — usa fonte real (HTTP), com rate-limit + retry + timeout
- `fixture`  — usa dataset embutido (zero rede)
- `disabled` — provider rejeita qualquer chamada (`NonRetriableError`)

Em **produção** recomendamos:

```env
LEXML_PROVIDER_MODE=live
STF_PROVIDER_MODE=live
STJ_PROVIDER_MODE=live
DATAJUD_PROVIDER_MODE=disabled   # vira live quando DATAJUD_API_KEY existir
```

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
- Lista de aliases prontos no Lex: `src/lib/corpus/providers/datajud-aliases.ts`.

---

## Aliases DataJud já mapeados

```
api_publica_stj      api_publica_tst       api_publica_tse
api_publica_stm      api_publica_trf1..6   api_publica_tjsp
api_publica_tjrs     api_publica_tjpr      api_publica_tjsc
api_publica_tjmg     api_publica_tjrj      api_publica_trt12
api_publica_tresc
```

Adicione mais em `datajud-aliases.ts` conforme necessário. Aliases extras
funcionam mesmo sem registro — basta passar a string para `DATAJUD_ALIAS`.

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
