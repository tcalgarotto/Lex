# Revisão manual — logs externos (Vercel / Sentry / Langfuse)

**Objetivo:** confirmar que painéis de observabilidade não persistem segredos, prompts ou documentos integrais.

**Não declarar sistema seguro** após esta revisão.

| Campo | Valor |
|-------|--------|
| **Data da revisão** | 2026-05-19 |
| **Responsável** | Cursor Agent (FASE 5.5) |
| **Ambiente gate** | local/dev (Postgres + Supabase Auth; sem deploy Vercel consultado) |
| **Janela** | rodadas red-team + CE.R* + Playwright 5.4/5.5 |

---

## Escopo da amostragem

| Fonte | Amostrado? | Resultado | Notas |
|-------|------------|-----------|--------|
| Vercel — Runtime Logs | ☐ painel | **PENDENTE** | `VERCEL_TOKEN` ausente; MCP Vercel sem `projectId`/`teamId` no repo |
| Vercel — rotas API (upload, completion, RAG, drafts) | ☐ painel | **PENDENTE** | Mesmo bloqueio; ver procedimento abaixo para assinatura humana |
| Sentry — Issues / breadcrumbs | ☐ painel | **PENDENTE** | `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` ausentes no `.env` local |
| Langfuse — Traces / generations | ☐ painel | **PENDENTE** | `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` ausentes → `getLangfuse()` retorna `null`; **nenhum trace exportado** no host de gate |
| ObservabilityLog (Postgres) | ☑ script | **PASSOU** | `npm run security:sample-observability-logs` — 200 registros, 0 padrões P0/P1 |
| Código (sinks + Langfuse input) | ☑ estático | **PASSOU** | `security:logs:review` P0=0 P1=0; chat usa `contentLen` / output redigido |

---

## Busca por padrões proibidos (painéis)

Padrões: `SUPABASE_SERVICE_ROLE`, `service_role`, `DEEPSEEK_API_KEY`, `sk-`, `Bearer eyJ`, cookies/JWT, `segredo ultra confidencial Bravo`, `extractedText`, PDF integral, `SYSTEM_BASE`, system prompt completo, `messages` com content integral, CPF/e-mail/telefone em claro.

| Painel | P0 | P1 | P2 | P3 | Achados |
|--------|----|----|----|-----|---------|
| Vercel | — | — | — | — | Não consultado (PENDENTE) |
| Sentry | — | — | — | — | Não consultado (PENDENTE) |
| Langfuse | — | — | — | — | Não consultado (PENDENTE); export desligado no host |

---

## Evidência substituta (host local, FASE 5.5)

1. **Langfuse:** sem chaves no `.env`, cliente não inicializa (`src/lib/observability/langfuse.ts`).
2. **Chat route:** `input` com `contentLen` apenas; `generation.end` com output redigido (`src/app/api/chat/[threadId]/route.ts`).
3. **DB:** amostra automatizada sem segredos/prompt integral.

Isso **não substitui** revisão dos painéis em staging/produção.

---

## Procedimento para assinatura humana (pendente)

### Vercel

1. Deploy staging/preview do gate.
2. Filtrar: `/api/documents/upload`, `/api/completion`, `/api/retrieval/search`, `/api/cases/*/drafts`.
3. Buscar padrões proibidos (sem colar conteúdo sensível no ticket).
4. Atualizar tabela “Escopo” para **PASSOU** ou **FALHOU**.

### Sentry

1. Issues últimas 72 h.
2. Breadcrumbs / extra / context — sem prompt/PDF/token.
3. Confirmar scrubbing de `Authorization` e cookies.

### Langfuse

1. Traces chat/completion/draft/retrieval após exercitar fluxos.
2. `input`/`output` só metadata ou redação — não texto integral.

---

## Classificação final (FASE 5.5)

| Item | Status |
|------|--------|
| ObservabilityLog (DB) | **PASSOU** |
| Código / logs estáticos | **PASSOU** |
| Vercel logs | **PENDENTE** |
| Sentry | **PENDENTE** |
| Langfuse (painel) | **PENDENTE** |

**Produção sensível:** **BLOQUEADA** até Vercel + Sentry + Langfuse assinados **PASSOU** (ou exceção P2/P3 documentada).

---

## Comandos

```bash
npm run security:logs:review
npm run security:sample-observability-logs
```
