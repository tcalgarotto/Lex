# Corpus Seeding — popular o índice jurídico do Lex

> Roteiro objetivo para encher o `lex_corpus_norms` e `lex_corpus_jurisprudence`
> sem depender de Inngest local nem chaves opcionais.

---

## Pré-requisitos

1. **Qdrant Cloud**: `QDRANT_URL` + `QDRANT_API_KEY` no shell ou no `.env`
2. **Postgres (Supabase)**: `DATABASE_URL` (pooler 6543) + `DIRECT_URL` (pooler 5432)
3. **DeepInfra**: `DEEPINFRA_API_KEY` (gera embeddings BGE-M3)
4. **Collections criadas** uma vez:

   ```bash
   npm run qdrant:init
   ```

---

## Caminho 1 — Bootstrap rápido (fixtures)

Sem rede, sem chaves opcionais, ~30s:

```bash
npm run corpus:seed:fixture
# ou
npm run corpus:sync -- --provider=FIXTURE --inline
```

Popula CDC, Código Civil, CPC, CF/88, súmula demo. **Suficiente para o
primeiro teste com advogado.**

---

## Caminho 2 — Vade mecum federal via LexML

LexML é público, sem chave. Cada `--max-pages=N` traz N×50 normas.

```bash
# Plan only (mostra o que seria pego, não escreve)
npm run corpus:seed:lexml:dry

# Leis ordinárias (CDC, CC, CPC, CLT, CTN, etc.)
npm run corpus:seed:lexml -- --kind=ORDINARY_LAW --max-pages=20

# Constituição + Emendas
npm run corpus:seed:lexml -- --kind=CONSTITUTIONAL_AMENDMENT --max-pages=5

# Decretos
npm run corpus:seed:lexml -- --kind=DECREE --max-pages=10

# Por área (usa LEXML_SEED_QUERIES — só puxa o que matchar)
npm run corpus:seed:lexml -- --areas=civil,contratos,familia
```

---

## Caminho 3 — Jurisprudência STF/STJ

```bash
# Súmulas STF + Súmulas Vinculantes
npm run corpus:seed:stf

# Súmulas STJ
npm run corpus:seed:stj
```

Estes scripts respeitam rate-limit (10 req/min) e timeout. Se o portal estiver
fora, o script termina sem erro fatal e o Inngest reagenda.

---

## Caminho 4 — Tudo público de uma vez

```bash
npm run corpus:seed:all-public:dry      # plan
npm run corpus:seed:all-public          # executa
```

Itera por FIXTURE → LEXML → STF → STJ. **Pula** DataJud automaticamente
(requer chave).

---

## Caminho 5 — DataJud (após chave)

Ver `docs/DATAJUD_SETUP.md`.

```bash
npm run datajud:check                                  # diagnóstico
npm run corpus:sync -- --provider=DATAJUD --max-pages=1
```

---

## Em produção (Inngest Cloud)

Sem `--inline` o `corpus:sync` dispara para Inngest, que processa async com
retries, throttle e watermark:

```bash
# Local mas dispatching para Inngest Cloud (não inline)
npm run corpus:sync -- --provider=LEXML --kind=ORDINARY_LAW --max-pages=20
```

Em produção real, agende isso uma vez por semana via Inngest Cloud (não usa
cron da Vercel — o plano Hobby só permite cron diário).

---

## Verificação

```bash
# Snapshot completo do corpus (totals, byKind, byTribunal, watermarks, jobs, providers, qdrant counts)
npm run corpus:stats

# Endpoint admin (apenas OWNER)
curl https://lex-navy.vercel.app/api/admin/corpus-stats | jq .

# Smoke retrieval — devolve fontes citadas (substitui endpoint de diagnóstico legado)
curl "https://lex-navy.vercel.app/api/retrieval/search?q=responsabilidade+civil+do+fornecedor&scope=tudo"
```

---

## Especialidades / áreas (não precisa marcar manualmente)

O `intent classifier` (`src/lib/retrieval/legal/intent.ts`) detecta a área da
pergunta e filtra por `tags` + `kind`. Tags vêm dos metadados oficiais do
LexML — você não precisa preencher. Para boosts adicionais por área, ver
`src/lib/legal/domain-packs/index.ts`.

---

## Limpeza / reindex

```bash
# Apaga collection do Qdrant (CUIDADO — produção precisa snapshot antes)
curl -X DELETE -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/lex_corpus_norms"
npm run qdrant:init
# Depois: rode os seeds novamente.
```

Para reindexar do Postgres existente sem refazer ingest, use o Inngest event
`lex/corpus.reindex` (worker `reindex-corpus`).
