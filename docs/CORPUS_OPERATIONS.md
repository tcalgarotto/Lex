# Corpus Operations — checklist de operação

> Passos rotineiros para manter o corpus jurídico saudável em produção.

---

## Diagnóstico diário

```bash
# Estado da infra (db, redis, qdrant, supabase)
curl https://lex-navy.vercel.app/api/health | jq .

# Estado do corpus (apenas OWNER, com session)
curl -H "Cookie: ..." https://lex-navy.vercel.app/api/admin/corpus-stats | jq .

# Local — completo
npm run corpus:stats
```

Sinais de alerta:
- `LegalNorm.count = 0` → corpus vazio, rode `corpus:seed:fixture`
- `IngestionJob.status = FAILED` recentes → ver `errorMessage`
- `IngestionWatermark.lastSyncAt > 7 dias` → reagendar
- Provider `not_configured` ≠ erro; só significa pendência de chave

---

## Como pausar um provider

Em emergência (provider externo down, abuso de rate, etc.):

1. **Vercel** → Settings → Environment Variables → Production
2. Defina `<PROVIDER>_PROVIDER_MODE=disabled` (ex.: `STF_PROVIDER_MODE=disabled`)
   ou `ENABLE_<PROVIDER>=false`
3. Redeploy
4. `npm run corpus:stats` confirma `disabled`
5. Inngest worker passa a lançar `NonRetriableError` claro — sem retry infinito.

---

## Como limpar um job travado

```bash
# Postgres
psql "$DATABASE_URL"
> UPDATE "IngestionJob"
>   SET status = 'FAILED', "finishedAt" = now(),
>       "errorMessage" = 'manual cancel'
>   WHERE id = '<job-id>' AND status = 'RUNNING';
```

Inngest Cloud também tem botão **Cancel** na UI, em "Functions → corpus-sync".

---

## Como resetar watermark (forçar re-sync completo)

```bash
psql "$DATABASE_URL"
> DELETE FROM "IngestionWatermark"
>   WHERE provider = 'LEXML' AND kind = 'ORDINARY_LAW';
```

Próximo `corpus:sync` começa do cursor inicial.

---

## Como reindexar Qdrant a partir do Postgres

```bash
# Via Inngest event
curl -X POST https://api.inngest.com/v1/events \
  -H "Authorization: Bearer $INNGEST_EVENT_KEY" \
  -d '{"name":"lex/corpus.reindex","data":{"limit":1000}}'

# Ou local
npm run ingest:corpus
```

> Útil quando você muda o modelo de embedding ou aumenta o tamanho do vector.

---

## Como rodar seed em produção (snapshot único)

Não rode seed em produção sem confirmação:

1. Antes — `npm run corpus:stats` para snapshot **antes**.
2. Use `--max-pages` pequeno (3-5) para evitar surpresas.
3. Rode com env de produção carregado:

   ```bash
   DATABASE_URL=... DIRECT_URL=... \
   QDRANT_URL=... QDRANT_API_KEY=... \
   DEEPINFRA_API_KEY=... \
   npm run corpus:seed:lexml -- --max-pages=3
   ```
4. Depois — `npm run corpus:stats` snapshot **depois**, confirme delta razoável.
5. Rode `corpus:stats` mais uma vez 1h depois (Inngest pode reagendar).

---

## Backup do Qdrant

```bash
# Snapshot manual (REST)
curl -X POST -H "api-key: $QDRANT_API_KEY" \
  "$QDRANT_URL/collections/lex_corpus_norms/snapshots"
```

Ou use snapshots automatizados do Qdrant Cloud (settings da UI).

---

## Como evitar scraping agressivo

- **Sempre rate-limited.** `acquireProviderSlot({ scope, ratePerMinute })`.
- **User-Agent identificável.** Permite o portal nos avisar antes de bloquear.
- **Throttle no Inngest.** `throttle: { limit: 4, period: "1m" }` por job.
- **maxPages obrigatório.** Default 5. Configurável por env.
- **Backoff exponencial.** Em 429/5xx, espera dobro a cada tentativa.
- **Timeout curto.** 30s/req — falha rápido em portal lento.

---

## Como validar com retrieval antes de demonstrar

```bash
# Smoke local
npm run retrieval:smoke

# Smoke remoto (logado)
curl "https://lex-navy.vercel.app/api/retrieval/explain?q=responsabilidade+civil+do+fornecedor"
```

Devem voltar fontes com `urn`, `score`, `confidence > 0.5` e citações resolvidas.

---

## Cartões de status no app

`/settings/readiness` mostra:
- Env vars críticas
- Redis
- Qdrant
- **Provedores jurídicos** (registry — uma linha por provider)

Se algo aparecer "Pendente", verifique env e redeploy.
