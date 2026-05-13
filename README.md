# Lex — Sistema operacional jurídico com IA

Copiloto jurídico pessoal com **RAG multicamada**, **memória persistente**, **perfil de estilo** e **editor inteligente**. Stack: Next.js 15, Prisma, PostgreSQL, Qdrant, Redis, Inngest, DeepSeek, BGE-M3 (DeepInfra).

## Jornada do usuário (caso-cêntrica)

Lex é organizado em torno do objeto **`Caso`**. O fluxo oficial é:

```
Criar caso  →  Enviar documentos  →  Acompanhar processamento
       →  Ver fatos/partes/pedidos/riscos  →  Pesquisar legislação (RAG)
       →  Pinar fundamentos  →  Gerar estratégia  →  Gerar peça  →  Revisar/exportar
```

**Rotas principais (menu primário):** `/dashboard` · `/cases` · `/documentos` · `/pesquisa-juridica` · `/editor` · `/processos` · `/settings/team` · `/settings/perfil`.

**Avançado/admin** (colapsável): `/cockpit`, `/strategy`, `/retrieval/explain`, `/settings/jobs`, `/settings/admin`.

**Redirects:** `/biblioteca` → `/pesquisa-juridica?scope=legislacao` · `/retrieval` → `/pesquisa-juridica`.

Documentação completa do fluxo, decisões e pendências: [`docs/UX_FLOW_AUDIT.md`](docs/UX_FLOW_AUDIT.md).

## Docs de release (P0 comercial)

- `docs/P0_COMMERCIAL_RELEASE_REPORT.md`
- `docs/COMMERCIAL_UX_P0_AUDIT.md`
- `docs/SECURITY_REVIEW_P0.md`
- `docs/CODE_REVIEW_P0.md`
- `docs/RETRIEVAL_PIPELINE_AUDIT.md`
- `docs/DEEPINFRA_EMBEDDING_AUDIT.md`
- `docs/UX_INSPIRATION_NOTES.md`

## Pré-requisitos

- Node.js 22+
- Docker & Docker Compose (Redis + Qdrant + MailHog locais)
- Projeto Supabase (Auth + Postgres + Storage)
- API keys: DeepSeek, DeepInfra (embeddings + reranker)

## Setup local

1. **Infraestrutura local (Redis + Qdrant + MailHog)**

```bash
cd docker && docker compose up -d redis qdrant mailhog
```

> O Postgres deste compose existe apenas como fallback. Em uso normal, conectamos no **Postgres do projeto Supabase** via pooler (ver passo 3), o que mantém Auth/Storage/DB no mesmo lugar.

2. **Variáveis (`.env`)**

```bash
cp .env.example .env
```

Preencha:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → `anon public`
- `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` (necessário só para upload/download via Storage admin)
- `DATABASE_URL` — pooler em **modo TRANSACTION** (porta 6543), com `?pgbouncer=true&connection_limit=1`
- `DIRECT_URL` — pooler em **modo SESSION** (porta 5432), usado por `prisma migrate`
- `SHADOW_DATABASE_URL` — **obrigatório em dev** para `prisma migrate dev` (shadow schema separado; não é reset)
- `DEEPSEEK_API_KEY`, `DEEPINFRA_API_KEY`

3. **Configurar Auth URLs no painel Supabase**

Authentication → URL Configuration:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/auth/callback`
  - `http://127.0.0.1:3000/**`

Sem trailing slash. Em produção adicione também a URL pública (ex.: `https://lex.app/**`).

4. **Banco (Prisma → Supabase)**

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # primeira vez; em dev local use migrate dev (requer SHADOW_DATABASE_URL)
npx prisma db seed
```

### Shadow DB / schema (recomendado para dev)

O Prisma usa um **shadow database** para calcular diffs durante `prisma migrate dev`. Neste repo, por padrão usamos
um **schema separado no mesmo Postgres** (mais seguro e barato do que um banco inteiro).

1) No Postgres do projeto (via SQL editor Supabase), execute:

```sql
CREATE SCHEMA IF NOT EXISTS shadow_prisma;
```

2) Na sua `.env`, configure:

- `SHADOW_DATABASE_URL`: copie o `DIRECT_URL` e adicione `?schema=shadow_prisma`

> Importante: nunca use shadow em produção. Em prod usamos somente `prisma migrate deploy`.

> Caso precise resetar (apaga tudo): `npx prisma migrate reset` (somente em dev).

5. **Qdrant — coleção**

```bash
npm run qdrant:init
```

O script carrega `.env` automaticamente (via `tsx --env-file`).

6. **Storage e RLS no Supabase**

Já estão aplicados via migrations (bucket `documents` privado + RLS por workspace). Caso precise recriar manualmente, veja `supabase/workspace_rls_template.sql`.

7. **Inngest (jobs)**

```bash
npx inngest-cli@latest dev
```

Em produção na Vercel, conecte o app ao Inngest Cloud.

8. **Dev**

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O servidor valida no boot via `instrumentation.ts` que `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão definidos, e avisa (sem travar) se `DIRECT_URL` ou `SUPABASE_SERVICE_ROLE_KEY` estiverem ausentes.

## Testes

| Comando | O que faz |
|---|---|
| `npm test` | Vitest unit (sem rede, rápido) |
| `npm run test:smoke` | Idem com reporter compacto |
| `npm run test:integration` | Vitest contra Postgres real (precisa `DATABASE_URL` exportado) |
| `npm run test:e2e` | Playwright (sobe `next dev` em paralelo automaticamente) |
| `npm run test:e2e:ui` | Playwright em modo UI (debug) |
| `npm run test:all` | Lint + typecheck + unit + build + E2E |
| `npm run ci` | Tudo que CI roda em PR (sem E2E) |
| `npm run smoke:team` | Smoke server-side ad-hoc do fluxo de invitations |

**E2E** rodam contra o app em modo dev. Os testes da suite atual cobrem:
- Páginas públicas (login/register/forgot/reset render correto, OAuth visível)
- Redirecionamentos do middleware (rotas privadas → `/login?next=`)
- `/api/health` e `/api/ready`
- Security headers (CSP, X-Frame-Options, Permissions-Policy)
- Origin guard (cross-origin POST → 403; `/api/inngest` whitelisted)
- APIs autenticadas devolvem 401 sem cookie

**Suite com auth real** (login + dashboard + team) requer um usuário de teste pré-provisionado no Supabase + storage state. Roteiro a fazer em workflow separado (`e2e-authed.yml`) quando os secrets estiverem configurados.

## Corpus jurídico nacional

O Lex mantém um corpus canônico de normas jurídicas brasileiras (legislação + jurisprudência) compartilhado entre workspaces. A arquitetura é multi-provider, multi-tenant-ready, incremental, versionada e idempotente.

**Modelo canônico** (Postgres):

- `LegalNorm` — entidade canônica identificada por **URN-LEX** (`urn:lex:br:federal:lei:1990-09-11;8078`).
- `LegalNormVersion` — snapshot temporal (vigência) com `validFrom`/`validTo` e `contentHash`.
- `LegalChunk` — chunk com **hierarquia tipada** (Parte/Livro/Título/Capítulo/Seção/Art./§/inciso/alínea), `fullPath` legível e `vectorPointId` no Qdrant.
- `LegalCitation` — aresta direcionada do grafo (CITES/REVOKES/REGULATES/...). `targetNormId` é resolvido lazy quando a norma destino for ingerida.
- `IngestionJob` + `IngestionWatermark` — auditoria por execução e cursor incremental por (provider, kind).

**Collections Qdrant** (idempotentes via `npm run qdrant:init`):

- `lex_corpus_norms` — legislação (lei, decreto, MP, EC, código, constituição).
- `lex_corpus_jurisprudence` — jurisprudência + súmulas (STF/STJ/TST).

**Camadas testáveis** (`src/lib/corpus/`):

- `urn.ts` — parser/builder URN-LEX, classificadores `kind`/`jurisdiction`, identificador humano.
- `normalize.ts` — canonicalização Unicode + símbolos jurídicos (Art./§/caput) + `canonicalizeForHash` para dedup.
- `legal-chunker-v2.ts` — chunker hierárquico com `fullPath` (`Título II › Capítulo I › Art. 5º`) e refs intra-artigo.
- `citations.ts` — extrator de citações por regex (Lei, LC, Decreto-Lei, MP, EC, Súmulas STF/STJ, códigos) → URN-LEX + confiança.
- `providers/{types,lexml,fixture}.ts` — interface `CorpusProviderClient`. LexML real via SRU (`https://www.lexml.gov.br/busca/SRU`). Fixture in-memory para testes/demo.
- `repository.ts` — upsert canônico idempotente por (URN, contentHash). Cria nova `LegalNormVersion` quando o conteúdo muda; encerra a anterior automaticamente.
- `embeddings-pipeline.ts` — batch (16) + retry com exponential backoff + dispatch por collection conforme `NormKind`.

**Inngest jobs**:

- `lex/corpus.sync` — orquestrador: lista candidatos do provider, persiste `IngestionWatermark`, fan-out por URN, re-agenda enquanto houver cursor.
- `lex/corpus.ingest-norm` — worker: `fetch → upsert → resolve citations → embed & upsert no Qdrant`. Throttle de 30/min por padrão para proteger embeddings provider.

**Trigger manual**:

```bash
# Em modo "inline" (sem fila) — rápido para validar com fixture:
npm run corpus:sync -- --provider=FIXTURE --inline --max-pages=2

# Disparando via Inngest (requer dev server):
npm run corpus:sync -- --provider=LEXML --kind=ORDINARY_LAW --max-pages=10
```

**Testes**:

- 52 unit (`urn`, `normalize`, `legal-chunker-v2`, `citations`, `providers`).
- 5 integration contra Postgres real cobrindo upsert idempotente, versioning e citations.
- Validado ponta-a-ponta com fixtures: 3 normas, 7 chunks, 2 citações com resolução automática.

## Retrieval jurídico enterprise

`src/lib/retrieval/legal/` é o **cérebro contextual** do Lex sobre o corpus. Cada query passa por um pipeline rastreável e explicável, sem efeitos colaterais entre etapas.

**Pipeline** (`retrieveLegalContext`):

1. **Cache lookup** — Redis com chave `sha256(query+filters+options)` (TTL 5 min, versionada por prefixo `lex:retrieval:legal:v2:`).
2. **Intent classification** (`intent.ts`) — extrai URN-LEX, tribunal (STF/STJ/TST/...), referência a artigo (`Art. 5º`), data "vigente em DD/MM/YYYY", `wantsSumula`, `wantsCurrent`, `prefersJurisprudence/Legislation`, `preferredKinds[]`. Reaproveita `classifyLegalQuery` legacy.
3. **Query rewriting** (`rewrite.ts`) — multi-query determinístico. Expande aliases (`CDC` ↔ `Lei 8.078/1990` ↔ `Código de Defesa do Consumidor`), gera forma com sinônimos extra, núcleo de termos, e variante com `articleRefs` injetados.
4. **Hybrid retrieval**:
   - **BM25** (`bm25.ts`) — Postgres FTS via coluna gerada `LegalChunk.textTsv` (`to_tsvector('portuguese')` + GIN index) e `ts_rank_cd`. Filtros aplicados no SQL: `kinds`, `jurisdictions`, `tribunals`, `normUrns`, `articleRefs`, `asOf` (versão válida na data), `publishedAfter`.
   - **Dense** (`dense.ts`) — embed BGE-M3, busca em `lex_corpus_norms` + `lex_corpus_jurisprudence` (decididas pelo intent), filtros nativos do payload Qdrant. Lineage resolvida em uma query Postgres.
5. **RRF fusion** (`hybrid.ts`) — `reciprocalRankFusion` (k=60) entre N listas (cada variante × cada modalidade). Preserva provenance e raw scores.
6. **Graph expansion** (`graph-expansion.ts`) — 1-hop `LegalCitation` (in + out) sobre os top-6 seeds. Para cada norma vizinha, escolhe o melhor chunk (preferindo EMENTA/PREAMBULO, senão menor ordinal não-genérico). Score: `0.45 × seedScore × 0.85^rank`.
7. **Cross-encoder rerank** (BGE-reranker-v2-m3 via DeepInfra) sobre o pool fundido. Falha graciosamente se reranker indisponível.
8. **Boosts** (`scoring.ts`):
   - **kind**: `SUMULA_VINCULANTE × 1.18`, `SUMULA_STF/STJ × 1.12`, `JURISPRUDENCE × 1.08`, `CONSTITUTION × 1.10`, etc.
   - **structure**: `ARTIGO × 1.10`, `CAPUT × 1.08`, `PARAGRAFO × 1.05`, `GENERIC × 0.85`.
   - **recency**: meia-vida de 4 anos (publishedAt → boost ∈ [0.85, 1.0]).
   - **intent alignment**: URN exato no intent `× 1.20`, tribunal `× 1.10`, kind preferido `× 1.05`, `articleRef` exato `× 1.15`.
9. **Grounding score** — `0.45 × top1 + 0.35 × top3Avg + diversidade + intentMatch`, mapeado para `Alta` (≥0.7), `Média` (≥0.45), `Baixa`.
10. **Observability log + cache write** — `recordObservabilityLog` quando há `workspaceId`; cache TTL configurável.

**Saída** (`LegalRetrievalResult`):

- `chunks[]` — cada `LegalRetrievedChunk` traz lineage completa (URN, versionId, validFrom/To, fullPath, articleRef, structure), `scores` discriminados (`dense/bm25/rerank/rrf/boost/final`), `provenance[]` (`dense | bm25 | graph_citation_in/out | rerank`) e `explanation` legível.
- `groundingScore` + `confidence{label,score,reason}`.
- `trace` completo: `traceId`, `totalLatencyMs`, `stages[]` cronometradas e `candidates{dense,bm25,afterFusion,afterGraph,afterRerank,final}`.
- `rewrittenQueries[]` + `intent` + `filters` aplicados — auditoria total.

**Smoke local**:

```bash
npm run retrieval:smoke -- "direitos fundamentais constituição"
# Imprime intent, rewrites, candidates por estágio, grounding e top-K com explanation.
```

**Cobertura de testes**:

- 38 unit (`intent`, `rewrite`, `hybrid`, `scoring`, `cache`).
- Integração contra Postgres real inclui `legal-retrieval-bm25` (FTS/BM25 em `LegalChunk`). Não há neste repo ficheiro de integração automatizada para o pipeline completo `retrieveLegalContext` (intent + graph + grounding); use `npm run retrieval:smoke` para validação manual quando necessário.

## Cobertura nacional de tribunais

Catálogo determinístico de 92 tribunais brasileiros em `src/lib/corpus/tribunals/registry.ts`:

| Tier        | Quantidade | Exemplos                          |
|-------------|------------|------------------------------------|
| Superiores  | 5          | STF, STJ, TST, TSE, STM           |
| TRFs        | 6          | TRF1…TRF6                         |
| TRTs        | 24         | TRT1 (RJ) … TRT24 (MS)            |
| TJs         | 27         | TJSP, TJRJ, TJDF…                 |
| TREs        | 27         | TRESP, TRERJ, TREDF…              |
| TJMs        | 3          | TJMSP, TJMRS, TJMMG               |

Cada entrada normaliza `urnAuthority`, `jurisdiction`, `tier`, UF e (quando aplicável) circuit. A factory em `src/lib/corpus/tribunals/factory.ts` mapeia o código do tribunal para o `CorpusProviderClient` adequado:

- `STF` → `StfCorpusProvider` (real, súmulas + SV).
- `STJ` → `StjCorpusProvider` (scaffold com extractor pluggable).
- `TST | TSE | STM` → `LexmlCorpusProvider` (legislação correlata).
- `TRFs | TRTs | TREs | TJs | TJMs` → `DatajudCorpusProvider` (alias `api_publica_<sigla>`, requer API key CNJ).

A rota `GET /api/retrieval/explain?tribunals=TJSP,STF` aplica filtro tribunal-aware ao retrieval.

## Legal Workflow Automation

Vertical operacional do Lex — **copiloto jurídico auditável**, NÃO agente autônomo. Conecta retrieval + reasoning a um pipeline determinístico de caso:

1. **Intake** (`src/lib/cases/intake.ts`): parser regex extrai partes (autor/réu, CPF/CNPJ, ente público), fatos numerados (com datas e categoria), pedidos (com tipo: principal/subsidiário/urgência/provas/processual), tribunal/UF/processo. **Sem LLM no caminho crítico**.
2. **Drafting** (`src/lib/cases/drafting.ts`): gera minuta Markdown estruturada (Endereçamento → Partes → Fatos → Direito → Pedidos → Tutela → Provas → Valor → Fechamento), ancorando "IV. Do direito" nos top chunks do retrieval e na `StrategySynthesis`.
3. **Review** (`src/lib/cases/review.ts`): checklist 0..1 com 8 critérios (estrutura, grounding, pedido principal, coerência da urgência, fatos, normas revogadas, divergência jurisprudencial, issues abertas) → `verdict` humano.
4. **Timeline** (`CaseTimelineEvent`): cada workflow registra evento com chunkIds e traceId. Memória processual auditável.
5. **Multi-tenant**: tudo escopado por `workspaceId`. Endpoints autenticados via middleware (401 sem sessão).

Endpoints:

- `GET  /api/cases` — lista casos do workspace.
- `POST /api/cases` — intake a partir de texto livre.
- `GET  /api/cases/[id]` — caso completo (fatos, partes, pedidos, riscos, drafts, reviews, timeline).
- `POST /api/cases/[id]/draft` — retrieval + reasoning + drafting + persiste minuta versionada.
- `POST /api/cases/[id]/review` — combina contradiction + issue-spotting + checklist.

UI premium em `/cases`, `/cases/new`, `/cases/[id]` com tabs Fatos · Partes · Pedidos · Riscos · Minuta · Review · Timeline · **Colaboração**.

Cobertura de testes: 24 unit (intake/drafting/review) + 5 unit orchestrator + 7 E2E (auth gate + endpoints).

## Cockpit operacional jurídico

Camada operacional premium do Lex — **timeline jurídica viva, integrações reais e collaborative intelligence** com Trust UX auditável. Tudo deterministicamente gerado, nunca por agente autônomo.

### A. Integrações reais do escritório (`src/lib/integrations/`)

Adapter pattern (`IntegrationAdapter`) com a mesma assinatura para todos os providers:

- **Tribunais**: `pjeAdapter`, `esajAdapter`, `projudiAdapter`, `eprocAdapter` (modo `mock` = fixtures determinísticos por workspace; modo `live` exige `secretRef`).
- **Diário Oficial**: `diarioOficialAdapter` (DOU + DJEs estaduais/federais por termos monitorados).
- **Mensageria**: `emailAdapter`, `whatsappAdapter` (transport-agnostic — Resend/SES/SMTP, Twilio/WhatsApp Cloud API).
- **Calendário**: `calendarAdapter` com gerador `renderIcs()` RFC-5545 nativo.
- **Webhook genérico**: para integrações custom.

**Credenciais nunca em plaintext.** O adapter consome `secretRef` (env var ou vault key); o segredo cru jamais entra no banco.

Endpoints:
- `GET  /api/integrations` — lista integrações do workspace.
- `POST /api/integrations` — cria/conecta uma integração (chama `health()` antes de persistir).
- `PATCH /api/integrations/[id]` — atualiza status/config/label.
- `DELETE /api/integrations/[id]` — remove.
- `POST /api/integrations/sync` — dispara `fetchEvents()` em todas as integrações conectadas, normalizando `IntegrationEvent` em `CaseAlert` idempotentes via `fingerprint`.

### B. Timeline jurídica viva (`src/lib/alerts/`)

`CaseAlert` cobre 9 categorias canônicas:

`JURISPRUDENCE_DRIFT`, `THESIS_WEAKENED`, `CONTEXTUAL_RISK`, `RISING_RISK`, `RELEVANT_MOVEMENT`, `STRATEGIC_HISTORY`, `NORM_REVOKED`, `PRECEDENT_DIVERGENCE`, `DEADLINE`.

`deriveAlerts()` (`src/lib/alerts/engine.ts`) classifica `ContradictionRisk` e `LegalIssue` em alertas com severidade (`INFO` → `CRITICAL`) e detecta queda de grounding ≥ 15% para sinalizar `RISING_RISK`.

Idempotência por `(workspaceId, fingerprint)` UNIQUE — sync repetido nunca duplica alertas.

Endpoints: `GET /api/alerts` (filtros por status/severity/caseId), `PATCH /api/alerts/[id]` (`ack`/`dismiss`/`resolve`).

### C. Collaborative intelligence (`src/lib/cases/collaboration.ts`)

- `CaseComment` (visibilidade WORKSPACE/PRIVATE, ref a chunkIds para fundamentar).
- `CaseAnnotation` (HIGHLIGHT/WEAKNESS/STRENGTH/TODO/CITATION com offsets sobre o draft Markdown).
- `DraftApproval` (REQUESTED → APPROVED/CHANGES_REQUESTED/REJECTED, com rationale).
- Knowledge sharing automático: cada comentário/aprovação gera entrada na `CaseTimelineEvent` e `Notification` no workspace.

Endpoints:
- `GET/POST /api/cases/[id]/comments`
- `GET/POST /api/cases/[id]/annotations`
- `GET/POST /api/cases/[id]/approvals`
- `PATCH /api/cases/[id]/approvals/[approvalId]` (decisão).

### D. Trust UX (auditabilidade visual)

Componentes em `src/components/trust/`:

- `<ForceBar />` — força argumentativa (4-segmentos) deterministicamente derivada do score 0..1.
- `<GroundingHeatmap />` — heatmap por chunk recuperado, intensidade ∝ rerank score.
- `<ConfidenceMeter />` — anel SVG com cor por faixa (rose < 0.4, amber < 0.7, emerald ≥ 0.7).
- `<DivergenceIndicator />` — sinaliza divergência jurisprudencial com nível none/low/medium/high.
- `<PrecedentStrength />` — badge "5 estrelas" para força de precedente (tribunal + score).
- `<ReasoningMap />` — pílulas Intent → Retrieval → Issues → Risks → Strategy com contagens por etapa.

Todos os componentes são **derivações deterministas dos dados** — sem animações randômicas, sem fetch implícito. Renderizam exatamente o que o pipeline computou.

### E. Notificações (`src/lib/notifications/`)

`Notification` com kinds `ALERT/COMMENT/APPROVAL/INTEGRATION/SYSTEM` e status `UNREAD/READ/ARCHIVED`. Suporta broadcast (`userId=null`) ou direcionada.

Endpoints: `GET /api/notifications` (lista + contagem unread), `PATCH /api/notifications` (`markAllRead`), `PATCH /api/notifications/[id]` (`markRead`).

### UI

- `/cockpit` — KPIs (alertas abertos / integrações conectadas / unread) + tabs Alertas · Integrações · Notificações.
- `/cases/[id]` — tab "Colaboração" com comentários, anotações e aprovações de minuta.
- `/strategy` — header `TrustUxOverview` com `ConfidenceMeter`, `DivergenceIndicator`, `ForceBar` (alinhamento, tese dominante, grounding global), `GroundingHeatmap` e `ReasoningMap`.

### Cobertura de testes

29 unit (fingerprint · 4, tribunals · 13, messaging · 5, calendar · 5, diario · 2, alerts engine · 5) + 7 E2E (cockpit auth + integrations + alerts + notifications + collaboration). Idempotência de alertas verificada via `fingerprintOf` determinístico (sha-256 16 chars).

## CI/CD

`.github/workflows/ci.yml` (em todo PR e push em `main`/`master`):

1. `lint-typecheck-test-build`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
2. `e2e`: sobe Redis + Qdrant como services, `npm run test:e2e`, faz upload do `playwright-report` como artifact

`.github/workflows/integration.yml` (manual + cron diário): sobe Postgres como service, roda `prisma migrate deploy` e `npm run test:integration`.

Para a suite de E2E completa com auth, adicione `e2e-authed.yml` consumindo secrets `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, etc.

## Docker

Build de produção multi-stage (`Dockerfile`):

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --build-arg NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
  -t lex:latest .

docker run --rm -p 3000:3000 \
  -e DATABASE_URL=... \
  -e DIRECT_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e REDIS_URL=... \
  -e QDRANT_URL=... \
  -e DEEPSEEK_API_KEY=... \
  -e DEEPINFRA_API_KEY=... \
  lex:latest
```

A imagem usa `output: standalone`, roda como user `nextjs` (uid 1001), e tem `HEALTHCHECK` apontando para `/api/ready`.

## Deploy (Vercel + Supabase)

1. **Supabase prod**: criar projeto separado do dev. Copiar URL/anon/service_role.
2. **Migrations**: rode `npx prisma migrate deploy` apontando `DATABASE_URL`/`DIRECT_URL` para o pooler do projeto prod (em CI ou localmente uma vez).
3. **Auth URLs**: em prod, adicione a URL pública (`https://<seu-domínio>/**` e `/auth/callback`) ao Supabase Auth.
4. **Qdrant Cloud**: copiar URL + API key → `QDRANT_URL`, `QDRANT_API_KEY`. Rodar `npm run qdrant:init` uma vez.
5. **Redis**: provisionar (Upstash, Redis Cloud, Railway). `REDIS_URL` com TLS (`rediss://`).
6. **Inngest Cloud**: conectar app, copiar `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY`.
7. **Vercel**:
   - Importar repo. `vercel.json` já configura framework + cron de health check.
   - **Production env vars**: cole TODAS as do `.env.example` com valores de produção. **Nunca** reuse a `SUPABASE_SERVICE_ROLE_KEY` do dev.
   - **Preview env vars**: configure separadamente apontando para um projeto Supabase de preview/staging (ou para o dev, se aceitável).
   - Vincule o domínio público.
8. **Healthcheck externo**: aponte uptime monitoring (Better Stack, Pingdom, UptimeRobot) para `https://<dominio>/api/health` (interval 1min, espera 200).

### Separação de ambientes

| Variável | Local | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projeto dev | projeto staging | projeto prod |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL do preview Vercel | domínio público |
| `DATABASE_URL` | pooler dev | pooler staging | pooler prod |
| `INNGEST_*` | dev keys | preview keys | prod keys |

### Health checks

- `GET /api/ready` — liveness (sempre 200, sem dependências externas)
- `GET /api/health` — readiness com checks (db/redis/qdrant/supabase). Retorna 503 quando críticos (db ou supabase) estão down.

## Smoke flow (fluxo jurídico completo)

Objetivo: validar o caminho “advogado real” ponta a ponta.

1. **Login**
- Abra `/login` e autentique via Supabase.

2. **Criar processo**
- Vá em `/processos` → crie um processo (número + título).

3. **Upload e processamento**
- Abra o processo → aba **Documentos**.
- Arraste um **PDF/DOCX**.
- Acompanhe status e progresso (PARSING → CHUNKING → EMBEDDING → INDEXED).
- Se falhar, use **Reprocessar** e verifique o erro exibido.

4. **Viewer / texto extraído**
- Clique em **Abrir** no documento.
- Confira **texto extraído**, **chunks**, **seções detectadas** e **hash**.

5. **Perguntar no chat com fontes**
- No processo → aba **Chat IA**.
- Faça uma pergunta objetiva sobre o documento.
- Verifique que a resposta mostra **Fontes usadas** (com trechos) e **confiança**.

6. **Gerar peça e editar**
- Aba **Peças** → clique **Gerar peça**.
- Escolha o tipo e descreva o objetivo (ex.: “manifestar sobre despacho…”).
- O sistema cria a peça e abre o editor.
- Edite e valide autosave: status **Salvando… / Salvo / Erro ao salvar**.

7. **Exportar**
- No editor, use **Exportar DOCX** e **Exportar PDF**.
- Verifique que o arquivo baixa com o título e o texto.

## Demonstração comercial para advogado (roteiro)

Pré-requisito rápido: rode `npm run seed:demo-legal` (cria um processo fictício com despacho/contestação demo e indexa no Qdrant).

### Script de fala sugerido (5–7 minutos)

1) **“Aqui está um processo realista de demo”**
- Abra `/processos` e entre no processo **“Ação indenizatória — negativação indevida (DEMO)”**.

2) **“O Lex lê o despacho e mantém a base verificável”**
- Vá em **Documentos** → abra `despacho-emenda-inicial-demo.txt`.
- Mostre **texto extraído** e **chunks/seções/hashes**.

3) **“Pergunto como advogado, recebo resposta com base”**
- Vá em **Chat IA** e pergunte:
  - “O que devo fazer diante deste despacho?”
- Mostre:
  - resposta em blocos (síntese/leitura/fundamentação/risco/providência)
  - **Confiança + justificativa**
  - **Fontes usadas** com tipo/seção/score e link “abrir”

4) **“Se não tiver base suficiente, ele recusa inventar”**
- Pergunte:
  - “Qual prazo eu tenho para responder esse despacho?”
- Mostre o comportamento:
  - se a base não for suficiente, o Lex inicia com **“Não localizei fonte suficiente…”** e não inventa prazo.

5) **“Geração de peça com guarda-chuva”**
- Vá em **Peças** → **Gerar peça**:
  - tipo: “manifestação”
  - objetivo: “manifestar sobre despacho de emenda à inicial e pedir prazo, juntando documentos”
- Mostre no editor:
  - painel lateral com **Confiabilidade** (confiança/avisos)
  - fontes usadas na geração

6) **“Exporto para protocolo”**
- Clique **Exportar DOCX** e **Exportar PDF**.

## Como apresentar o Lex para o primeiro advogado

### Abertura (30s)
“O problema não é gerar texto: é manter **base verificável**, **memória consistente** e **estilo do escritório**, sem inventar fundamento.”

### Demonstração (5–7 min)
- “O Lex lê documentos e segmenta em seções — não é só upload.”
- “Cada resposta vem com **fontes usadas pela IA** e **confiança jurídica**.”
- “Se não houver base suficiente, ele começa avisando e não inventa prazo/artigo/precedente.”
- “Geração de peça tem guarda-chuva: quando a base é insuficiente, ele gera checklist/rascunho e exige revisão.”
- “Editor com autosave + exportação DOCX/PDF.”

### Diferencial (30s)
- “Memória do processo + RAG multicamada + estilo do advogado, com observabilidade de custo e retrieval.”

### Encerramento (30s)
“A meta é reduzir tempo e risco: mais produtividade, menos alucinação, e rastreabilidade do que foi usado.”

## Scripts úteis

| Script | Descrição |
|--------|-----------|
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed demonstrativo |
| `npm run qdrant:init` | Cria coleção e índices Qdrant |
| `npm run ingest:corpus` | Indexa `LegalSource` no Qdrant (`seed/ingest-corpus.ts`; requer `.env` e serviços) |
| `npm run seed:demo-legal` | Cria processo demo realista + indexa docs e fontes no Qdrant |

**Nota:** rodar `db:seed` duas vezes duplica fontes em `LegalSource`. Para reset limpo use `prisma migrate reset` em desenvolvimento.

## Arquitetura

- `src/lib/domain` — entidades e casos de uso
- `src/lib/repositories` — Prisma / adaptadores
- `src/lib/services` — orquestração
- `src/lib/ai` — LLM, embeddings, prompts
- `src/lib/retrieval` — Qdrant hybrid + RRF + rerank
- `src/lib/parsers` — PDF/DOCX/OCR + chunking jurídico
- `src/lib/inngest` — pipelines assíncronos

## Licença

Proprietary — Lex ©
# Lex
