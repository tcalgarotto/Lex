# DataJud (CNJ) — guia de configuração

> O DataJud é a API pública do CNJ que devolve **metadados de processos** (não
> peças nem decisões integrais). É a fonte canônica para movimentações,
> classes, assuntos, partes (anonimizadas) e timeline processual.

---

## Status atual no Lex

Sem `DATAJUD_API_KEY`, o provider fica em **`not_configured`** — visível em:
- `GET /api/health` no array `providers[]`
- `GET /api/admin/corpus-stats` (OWNER)
- `npm run corpus:stats`
- `npm run datajud:check`

Build, deploy, retrieval, dashboard, jobs — **nada quebra**. Apenas DataJud
não pode ser invocado.

---

## Pré-requisitos

1. Cadastro no portal CNJ (não precisa OAB):
   - Acesse <https://datajud-wiki.cnj.jus.br/api-publica/acesso>
   - Preencha o formulário (motivo: "desenvolvimento de sistema jurídico")
   - Aguarde email com a chave (geralmente em poucos minutos a horas)

2. Escolha um alias inicial. Recomendado para começar:
   - `api_publica_tjsp` (maior volume)
   - `api_publica_stj` (precedentes)
   - `api_publica_trf3` ou `api_publica_trf4` (federal)

---

## Variáveis para Vercel (Production)

```env
DATAJUD_API_KEY=<key-do-CNJ>
DATAJUD_ALIAS=api_publica_tjsp
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_PROVIDER_MODE=live
ENABLE_DATAJUD=true
DATAJUD_DEFAULT_PAGE_SIZE=100
DATAJUD_MAX_PAGES_PER_SYNC=10
DATAJUD_RATE_LIMIT_PER_MINUTE=30
```

> Lembre-se: edite no escopo **Production** + **Redeploy**.

---

## Validação

```bash
# 1. Diagnóstico estático
npm run datajud:check

# Esperado se ok:
# {
#   "status": "ok",
#   "mode": "live",
#   "envKeysSet": { "DATAJUD_API_KEY": true, "DATAJUD_ALIAS": true, ... },
#   "alias": "api_publica_tjsp",
#   "aliasEntry": { "tribunal": "TJSP", ... },
#   "probe": { "ok": true, "httpStatus": 200, "tookMs": 743, "sampleHits": 1 }
# }

# 2. Dry-run (mostra query Elasticsearch sem enviar)
npm run datajud:dry-run

# 3. Sync mínimo
npm run corpus:sync -- --provider=DATAJUD --max-pages=1
```

---

## Query builder

`buildDatajudListQuery(args)` em `src/lib/corpus/providers/datajud.ts` aceita:

```ts
{
  size: number,
  cursor?: string | null,             // search_after JSON
  tribunal?: string,                  // "TJSP"
  classe?: number | string,           // código CNJ da classe
  grau?: "G1" | "G2",
  orgaoJulgador?: number | string,
  assunto?: number | string,          // código CNJ do assunto
  numeroProcesso?: string,            // qualquer formato; é normalizado
  dataAjuizamentoFrom?: string,       // ISO yyyy-mm-dd
  dataAjuizamentoTo?: string,
  atualizadoDesde?: string,           // ISO datetime; usa @timestamp gte
}
```

A query gerada segue o formato Elasticsearch documentado em
<https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo3>.

---

## Aliases já mapeados

Lista completa em `src/lib/corpus/providers/datajud-aliases.ts`. Para
adicionar um tribunal não listado, basta usar o alias diretamente em
`DATAJUD_ALIAS`. O provider não exige que o alias esteja no registry.

---

## Política de uso

- **Não baixar tudo de uma vez.** Use `DATAJUD_MAX_PAGES_PER_SYNC` baixo (10).
- **Cursor incremental.** Watermark por `(provider, kind)` evita reprocessar.
- **Rate-limit cooperativo.** Token bucket de 30 req/min por padrão.
- **Sem dados sigilosos.** Não armazene processos em segredo de justiça.
- **User-Agent identificável.** O cliente envia `lex-corpus-sync/1.0 (+https://lex-navy.vercel.app)`.

---

## Troubleshooting

| Erro | Causa | Ação |
|---|---|---|
| `DATAJUD_API_KEY não configurada` | env vazia | Adicionar em Vercel + Redeploy |
| `Datajud respondeu 401` | chave revogada/typo | Conferir chave no email do CNJ |
| `Datajud respondeu 429` | rate-limit estourou | Reduzir `DATAJUD_RATE_LIMIT_PER_MINUTE` |
| `provider not_configured` no `/api/health` | falta key ou alias | `npm run datajud:check` mostra qual falta |

---

## XSDs do DataJud (referência)

O CNJ disponibiliza XSDs descrevendo o schema completo dos metadados
processuais. Esses XSDs **não** são usados em runtime do Lex (o consumo é via
JSON da API REST), mas servem para entender e validar campos.

Recomendação: mantenha localmente em `docs/datajud-xsd/` (não versionado se
forem grandes). Use ferramentas como `xmllint` ou `xsd2ts` para inspecionar.
