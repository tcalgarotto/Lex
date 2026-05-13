# Lex — Sistema operacional jurídico com IA

Copiloto jurídico **caso-cêntrico** com **RAG multicamada** (corpus nacional + documentos do workspace), **Case Brain** (partes, fatos, pedidos, riscos, timeline), **memória e estilo do escritório**, **processos judiciais** (CNJ / integrações oficiais), **pesquisa jurídica auditável** e **editor de peças** com exportação.

**Stack principal:** Next.js 15 (App Router, `serverActions`, Turbopack em dev), React 19, TypeScript, Prisma 6, PostgreSQL (Supabase), Qdrant, Redis (opcional em dev), Inngest, Supabase Auth + Storage, DeepSeek + DeepInfra (embeddings BGE-M3, reranker).

---

## Jornada do usuário (caso-cêntrica)

Lex organiza o trabalho em torno do **`Caso`**. Fluxo típico:

```
Criar caso (/cases/new — entrevista fundamental)  →  Documentos do caso  →  Case Brain consolida inteligência
       →  Fatos · Partes · Pedidos · Riscos  →  Pesquisa jurídica (corpus)  →  Estratégia / minuta
       →  Peças no editor  →  Revisão / export (DOCX/PDF)
```

**Entrevista guiada (checklist):** em cada caso, a aba **Entrevista guiada** (`/cases/[id]/entrevista`) usa **modelos fixos** definidos em código (`src/lib/cases/checklists/`). Não há mais criação de “roteiros” personalizados por workspace; o intake principal estruturado fica em **`/cases/new`**.

**Processos judiciais** (objeto `Process` no banco): cadastro por CNJ, documentos, chat contextual ao processo, linha do tempo — em **`/processos`** e **`/processos/[processId]`**.

**Rotas principais (menu da app):**

| Rota | Descrição |
|------|-------------|
| `/dashboard` | Briefing do dia, próximas ações, resumo operacional |
| `/cases` | Lista de casos |
| `/cases/new` | **Entrevista fundamental** (formulário + estruturação com IA) |
| `/cases/[id]` | Visão do caso: **Visão geral**, **Entrevista guiada**, **Partes e fatos**, **Documentos**, **Pesquisa jurídica**, **Estratégia e peças** (sub-rotas em `/cases/[id]/…`) |
| `/cases/[id]/entrevista` | Checklist de entrevista guiada (templates estáticos) |
| `/documentos` | Documentos do workspace (biblioteca operacional de ficheiros) |
| `/biblioteca` | Prateleiras: normas/livros partilhados, documentos privados do escritório, ligação ao catálogo global quando configurado |
| `/biblioteca/leis` · `/biblioteca/livros` | Catálogos por prateleira |
| `/biblioteca/fundamentos` · `/biblioteca/memoria` | Fundamentos curados e memória do workspace |
| `/pesquisa-juridica` | Pesquisa assistida no corpus canónico + UI de confiança |
| `/editor` · `/editor/[pieceId]` | Peças e editor |
| `/processos` · `/processos/[processId]` · `/processos/analytics` | Processos judiciais, detalhe por CNJ, painel analítico DataJud |
| `/publicacoes` | Registo/import de **publicações oficiais** (DJEN, diário, portal tribunal, etc.) com revisão humana |

**Redirecionamento legado:** `GET /retrieval` → `/pesquisa-juridica`. **`/retrieval/explain`** mantém-se como modo técnico de auditoria do retrieval.

**Configurações (`/settings/…`):** `perfil`, `estilo`, `team`, `integracoes` (conectores judiciais oficiais / pontes), `jobs`, `readiness`, `admin` (custos/observabilidade para quem tem permissão).

**Avançado / produto & marketing (conforme flags e permissões):** `/cockpit`, `/strategy`, `/retrieval/explain`, `/test-guide` (guia de primeiro teste), `/demo`, `/apresentacao`, `/busca`.

Documentação de fluxo UX e auditorias: [`docs/UX_FLOW_AUDIT.md`](docs/UX_FLOW_AUDIT.md). Pipeline Case Brain: [`docs/CASE_BRAIN.md`](docs/CASE_BRAIN.md). Métodos de trabalho no dashboard: [`docs/features/DASHBOARD_WORK_METHODS.md`](docs/features/DASHBOARD_WORK_METHODS.md).

---

## Docs de release e governança (P0 comercial)

- `docs/P0_COMMERCIAL_RELEASE_REPORT.md`
- `docs/COMMERCIAL_UX_P0_AUDIT.md`
- `docs/SECURITY_REVIEW_P0.md`
- `docs/CODE_REVIEW_P0.md`
- `docs/RETRIEVAL_PIPELINE_AUDIT.md`
- `docs/DEEPINFRA_EMBEDDING_AUDIT.md`
- `docs/UX_INSPIRATION_NOTES.md`

---

## Pré-requisitos

- **Node.js 22+**
- **Docker** (opcional mas recomendado: Redis, Qdrant, MailHog; o compose inclui Postgres local se quiser um DB fora do Supabase)
- **Projeto Supabase** (Auth + Postgres + Storage) para o caminho oficial de desenvolvimento
- **Chaves:** DeepSeek, DeepInfra (embeddings + reranker); opcionais conforme `.env.example` (DataJud, Resend, Sentry, Langfuse, etc.)

---

## Setup local

### 1. Infraestrutura local (Redis + Qdrant + MailHog)

Na raiz do repositório:

```bash
npm run infra:up
```

Equivale a `docker compose -f docker/docker-compose.yml up -d redis qdrant mailhog`.

O serviço **postgres** no mesmo ficheiro existe para quem quiser um Postgres 100 % local; em fluxo normal o app usa **Postgres do Supabase** (Auth/Storage/DB alinhados).

### 2. Variáveis (`.env`)

```bash
cp .env.example .env
```

Campos críticos estão documentados no próprio `.env.example` (`DATABASE_URL` modo transaction no pooler, `DIRECT_URL` modo session para migrations, `SHADOW_DATABASE_URL` para `prisma migrate dev`, Supabase, Redis, Qdrant, Inngest, IA).

**Feature flags** (`ENABLE_*` no `.env.example`): desligam módulos (corpus sync, legal retrieval, cockpit, strategy, integrações mock, etc.) sem alterar código.

### 3. Auth no Supabase

Authentication → URL Configuration:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/auth/callback`, `http://localhost:3000/**`, e equivalentes em `127.0.0.1`

Em produção, acrescente o domínio público.

### 4. Banco (Prisma → Supabase)

```bash
npm install
npx prisma generate
```

- **Primeira aplicação de migrations no ambiente:** `npx prisma migrate deploy` (recomendado em **staging/prod** e sempre que o histórico de `prisma/migrations` avançar).
- **Desenvolvimento com shadow DB:** `npm run db:migrate` (`prisma migrate dev`) — exige `SHADOW_DATABASE_URL` (ex.: schema `shadow_prisma` no mesmo Postgres; ver comentários no `.env.example`).

> **Drift:** se o Postgres remoto já foi alterado manualmente ou foge do replay das migrations, `migrate dev` pode pedir `reset` (destrutivo). Nesse caso prefira `migrate deploy` para aplicar só migrations pendentes e trate divergências com migrations de reconciliação ou SQL controlado — nunca `reset` em dados reais.

```bash
npx prisma db seed
```

O seed cria utilizador/workspace de demo, cliente, **processo** de exemplo e thread de chat (ver `prisma/seed.ts`).

### 5. Shadow DB (recomendado para `migrate dev`)

1. No SQL editor do Supabase: `CREATE SCHEMA IF NOT EXISTS shadow_prisma;`
2. `SHADOW_DATABASE_URL` = copiar `DIRECT_URL` e acrescentar `?schema=shadow_prisma`

### 6. Qdrant

```bash
npm run qdrant:init
```

### 7. Storage e RLS

Políticas e bucket privado `documents` vêm nas migrations Prisma/Supabase; template adicional em `supabase/workspace_rls_template.sql` se precisar recriar manualmente.

### 8. Inngest (filas)

```bash
npx inngest-cli@latest dev
```

Em produção (ex.: Vercel), ligar ao Inngest Cloud com as variáveis `INNGEST_*`.

### 9. Servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O `instrumentation.ts` valida no arranque variáveis mínimas (`DATABASE_URL`, Supabase público) e avisa se faltarem outras.

Atalho com Docker: `npm run dev:full` (sobe infra + `next dev`).

---

## Testes

| Comando | O que faz |
|---------|-----------|
| `npm test` | Vitest unitário (rápido, sem rede por defeito) |
| `npm run test:smoke` | Idem com reporter compacto |
| `npm run test:integration` | Vitest com Postgres real (`DATABASE_URL`) |
| `npm run test:e2e` | Playwright |
| `npm run test:e2e:ui` | Playwright UI |
| `npm run test:all` | lint + typecheck + unit + build + E2E |
| `npm run ci` | O que o CI de PR costuma correr (sem E2E) |
| `npm run smoke:team` | Smoke server-side do fluxo de convites |

A suite E2E cobre gates de auth, health, headers, APIs sem cookie, etc. Testes **com login real** no Supabase exigem secrets e workflow dedicado (ver docs de QA / `e2e-authed` quando existir).

---

## Corpus jurídico nacional

Corpus **partilhado** de normas brasileiras (legislação + jurisprudência), multi-provider, incremental e versionado.

**Modelo Postgres (canônico):** `LegalNorm` (URN-LEX) → `LegalNormVersion` → `LegalChunk` (hierarquia tipada, `fullPath`, BM25 via `textTsv` gerada, vetor no Qdrant) → `LegalCitation`. `IngestionJob` / `IngestionWatermark` para auditoria e cursores.

**Provedores** (`CorpusProvider` no schema): inclui entre outros `LEXML`, `STF`, `STJ`, `PLANALTO`, `DATAJUD`, `CAMARA`, `SENADO` (dados abertos da Câmara e do Senado), `MANUAL`, `FIXTURE`. Modo `fixture` em dev evita dependência de rede.

**Coleções Qdrant** (inicialização via `npm run qdrant:init`): `lex_corpus_norms`, `lex_corpus_jurisprudence` (nomes configuráveis por env).

**Código principal:** `src/lib/corpus/` — URN, normalização, chunker, citações, providers, repositório, pipeline de embeddings. Jobs Inngest: `lex/corpus.sync`, `lex/corpus.ingest-norm`, entre outros.

**Scripts úteis:** `npm run corpus:sync`, `npm run corpus:seed:*` (fixture, lexml, stf, stj, leis oficiais, minimal, etc. — ver `package.json`), `npm run corpus:stats`, `npm run corpus:reset` (cuidado).

---

## Retrieval jurídico

`src/lib/retrieval/legal/` implementa o pipeline **`retrieveLegalContext`**: cache Redis, classificação de intent, reescrita de queries, **híbrido BM25 + denso** (Postgres FTS + Qdrant), fusão RRF, expansão por grafo de citações, rerank cross-encoder (DeepInfra), boosts, grounding e trace para UI/debug.

**Smoke manual:** `npm run retrieval:smoke -- "sua consulta aqui"`.

**UI:** `/pesquisa-juridica` e `/retrieval/explain` (auditoria). API: `/api/retrieval/explain`, `/api/retrieval/search`, etc.

---

## Casos, Case Brain e automação jurídica

- **Criação de caso:** `POST /api/cases` (modo relato livre + intake regex opcional) ou fluxo **`POST /api/cases/fundamental-intake`** a partir de `/cases/new`.
- **Consolidação:** Inngest `lex/case.brain` e funções em `src/lib/inngest/functions/` + `src/lib/cases/case-brain/`.
- **Entrevista guiada:** respostas em checklist → extração estruturada (`interview-extraction`), `metadataJson.brain`.
- **Minuta / revisão / timeline:** drafting, review, `CaseTimelineEvent` — ver rotas em `src/app/api/cases/[id]/`.
- **UI:** tabs em `/cases/[id]` (inclui colaboração, comentários, aprovações).

**Multi-tenant:** todo acesso a dados de caso exige `workspaceId` coerente com a sessão.

---

## Processos, integrações e publicações

- **`/processos`:** lista, import/manual, ligação a DataJud quando configurado.
- **`/settings/integracoes`:** catálogo de **conectores judiciais** (registry em `src/lib/court-connectors/`) — estados `active`, `public_read_only`, `manual_bridge`, credenciais oficiais, etc., **sem** guardar senha de tribunal no Lex.
- **`/publicacoes`:** registo de comunicações/publicações oficiais (`OfficialCommunication`) para revisão e encaminhamento operacional.

---

## Cockpit, alertas, notificações

Ver secções já implementadas em `src/lib/alerts/`, `src/lib/integrations/`, `src/lib/notifications/`, UI `/cockpit`, tab Colaboração no caso, `/strategy` com componentes Trust UX em `src/components/trust/`.

---

## CI/CD

`.github/workflows/ci.yml`: lint, typecheck, testes unitários, build; job E2E com Redis + Qdrant como services.

`.github/workflows/integration.yml`: Postgres de serviço + `prisma migrate deploy` + testes de integração.

**Vercel:** `vercel.json` define build/install e headers de cache para `/api/*`. Configure variáveis de ambiente por ambiente (dev / preview / prod) conforme `.env.example`.

---

## Docker (imagem da app)

O repositório inclui `Dockerfile` com output **standalone** do Next.js. Exemplo:

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

---

## Deploy resumido (Vercel + Supabase)

1. Projeto Supabase de produção (URL, anon, service_role).
2. `npx prisma migrate deploy` com `DATABASE_URL` / `DIRECT_URL` de produção.
3. Auth URLs de produção no Supabase.
4. Qdrant Cloud + `npm run qdrant:init` uma vez por ambiente.
5. Redis gerido (`rediss://`).
6. Inngest Cloud (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`).
7. Importar repo na Vercel e copiar **todas** as variáveis necessárias (nunca reutilizar `service_role` de dev em prod).

**Health:** `GET /api/ready` (liveness), `GET /api/health` (readiness: DB, Redis, Qdrant, Supabase conforme configurado).

---

## Fluxo de smoke (advogado)

1. Login em `/login`.
2. **`npm run db:seed`** (ou workspace já existente).
3. **Casos:** criar caso em `/cases/new` ou listar em `/cases`; abrir caso e percorrer documentos, entrevista guiada, partes/fatos.
4. **Processos:** `/processos` — o seed cria um processo de exemplo (*"Ação declaratória – cumprimento contratual"* com número sentinela); anexar PDF/DOCX na UI do processo quando aplicável.
5. **Pesquisa:** `/pesquisa-juridica` com consulta objetiva; verificar citações e confiança.
6. **Peças:** `/editor` — gerar/editar/exportar DOCX/PDF conforme funcionalidades expostas na UI.

Para um **guia passo-a-passo** copiável (incluindo `/test-guide`), use a página **`/test-guide`** no ambiente logado.

---

## Scripts npm (seleção)

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Next dev (Turbopack) |
| `npm run build` / `npm start` | Build produção + servidor |
| `npm run lint` / `npm run typecheck` | Qualidade estática |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:migrate:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Seed Prisma (`prisma/seed.ts`) |
| `npm run infra:up` / `infra:down` | Docker compose (redis, qdrant, mailhog) |
| `npm run qdrant:init` | Coleções / índices Qdrant |
| `npm run corpus:*` | Sync, seed, stats, reset — ver `package.json` |
| `npm run retrieval:smoke` | Smoke do retrieval jurídico |
| `npm run deploy:check` | Checagens pré-deploy (env) |

> Rodar `db:seed` várias vezes pode duplicar entidades que o seed não faz upsert — use apenas em dev ou ajuste o seed.

---

## Arquitetura de pastas (`src/lib`)

Organização real (não há `src/lib/domain` nem `src/lib/repositories` como pacotes separados):

| Área | Pastas / exemplos |
|------|---------------------|
| Casos & Brain | `cases/`, `cases/case-brain/`, `cases/fundamental-intake/`, `cases/checklists/`, `cases/drafting/` |
| Corpus & tribunais | `corpus/`, `corpus/providers/`, `corpus/tribunals/`, `datajud/` |
| Retrieval | `retrieval/legal/`, `retrieval/vector-store/`, `retrieval/hybrid-retriever.ts` |
| Documentos & parsers | `documents/`, `parsers/` |
| Processos & conectores | `legal-processes/`, `court-connectors/`, `court-links/` |
| Comunicações oficiais | `official-communications/`, `official-publications/` |
| Integrações escritório | `integrations/` |
| Alertas & notificações | `alerts/`, `notifications/` |
| Auth & workspace | `auth/`, `supabase/` |
| IA | `ai/`, `legal-research/` |
| Jobs | `inngest/` |
| Dashboard & UI data | `dashboard/` |
| Observabilidade & custos | `observability/`, `cost/` |
| Biblioteca global | `biblioteca/` |

Componentes de UI em `src/components/`; rotas App Router em `src/app/`.

---

## Licença

Proprietary — Lex ©
