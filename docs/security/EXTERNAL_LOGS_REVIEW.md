# Revisão manual — logs externos (Vercel / Sentry / Langfuse)

**Objetivo:** confirmar que painéis de observabilidade não persistem segredos, prompts ou documentos integrais.

**Não declarar sistema seguro** após esta revisão.

| Campo | Valor |
|-------|--------|
| **Data da revisão** | 2026-05-19 |
| **Responsável** | Thales (PO) + Cursor Agent (FASE 5.6) |
| **Ambiente gate** | Produção sem usuários reais / staging-like (deploy Vercel acessível; Sentry org **lotys**; Langfuse projeto **lex**, região US) |
| **Janela amostrada** | Logs e traces disponíveis na rodada FASE 5.5–5.6 (últimas sessões de gate, smoke e `/sentry-example-page`) |

---

## Escopo da amostragem

| Fonte | Amostrado? | Resultado | Notas |
|-------|------------|-----------|--------|
| Vercel — Runtime Logs | ☑ painel | **PASSOU** | Logs revisados visualmente: aliases `env-normalize`, Inngest Web Crypto signing, requests `200` em `/`, `/login`, `/dashboard`, `/api/inngest`. Sem P0/P1. |
| Vercel — rotas API / functions | ☑ painel | **PASSOU** | Mesma janela; apenas mensagens operacionais. Nenhum `service_role`, API key, JWT/cookie, prompt/documento integral ou segredo Bravo observado. |
| Sentry — Issues / breadcrumbs | ☑ painel | **PASSOU** | Apenas eventos **controlados** de teste: `Sentry Test Error — Lex verification`, `Sentry test message — Lex verification`, rota `/sentry-example-page`. Detalhe do evento revisado: sem `Authorization`, cookie, service role, API key, prompt/PDF integral ou segredo Bravo. |
| Langfuse — Traces / generations | ☑ painel | **PASSOU** | Traces `langfuse-smoke-test`; input/output simples (resposta `ok`); metadata com origem `scripts/test-langfuse-trace.ts`. Sem documento jurídico integral, segredo Bravo, token ou system prompt completo. |
| ObservabilityLog (Postgres) | ☑ script | **PASSOU** | `npm run security:sample-observability-logs` — 200 registros, 0 padrões P0/P1 |
| Código (sinks + Langfuse input) | ☑ estático | **PASSOU** | `security:logs:review` P0=0 P1=0; rotas usam `inputSummary` (len/count), OTEL + `aiTelemetry` |

---

## Busca por padrões proibidos (painéis)

Padrões: `SUPABASE_SERVICE_ROLE`, `service_role`, `DEEPSEEK_API_KEY`, `sk-`, `Bearer eyJ`, cookies/JWT, `segredo ultra confidencial Bravo`, `extractedText`, PDF integral, `SYSTEM_BASE`, system prompt completo, `messages` com content integral, CPF/e-mail/telefone em claro.

| Painel | P0 | P1 | P2 | P3 | Achados |
|--------|----|----|----|-----|---------|
| Vercel | 0 | 0 | 0 | 0 | Nenhum padrão proibido na amostra visual |
| Sentry | 0 | 0 | 0 | 0 | Somente teste controlado `/sentry-example-page`; sem dados sensíveis no detalhe do evento |
| Langfuse | 0 | 0 | 0 | 0 | Somente smoke test controlado; input/output/metadata sem segredos |

---

## Sentry — eventos de teste controlado (FASE 5.6)

| Evento | Classificação | Ação recomendada |
|--------|---------------|------------------|
| `Sentry Test Error — Lex verification` | Teste controlado (não incidente) | Resolver/arquivar no painel para não poluir Issues |
| `Sentry test message — Lex verification` | Teste controlado | Idem |
| Origem `/sentry-example-page` | Rota de verificação documentada | Manter rota; não tratar como falha de produção |

**Evidência:** eventos intencionais da verificação pós-integração Sentry; nenhum evento real não resolvido com dados sensíveis identificado na amostra.

---

## Langfuse — smoke test (FASE 5.6)

| Campo | Observação |
|-------|------------|
| Trace name | `langfuse-smoke-test` |
| Input | Texto mínimo de smoke (não documento jurídico) |
| Output | `ok` |
| Metadata | `source: scripts/test-langfuse-trace.ts`, tags `smoke` |
| Risco na amostra | Nenhum P0/P1 |

Traces de fluxos reais (chat, minuta) devem continuar sendo amostrados após tráfego de usuários; na rodada 5.6 só havia smoke controlado no painel.

---

## Evidência histórica (FASE 5.5 — substituída)

Revisão anterior sem acesso aos painéis (host local sem keys) — **substituída** por assinatura 5.6 acima. Evidência estática local (código + DB) permanece válida como complemento, não como substituto dos painéis.

---

## Classificação final (FASE 5.6)

| Item | Status |
|------|--------|
| ObservabilityLog (DB) | **PASSOU** |
| Código / logs estáticos | **PASSOU** |
| Vercel logs | **PASSOU** |
| Sentry | **PASSOU** |
| Langfuse (painel) | **PASSOU** |

**Produção sensível:** **APROVADA PARA RELEASE CANDIDATE** — painéis externos assinados sem P0/P1 na amostra.

**Não declarar sistema seguro.**

---

## Comandos (revalidação)

```bash
npm run security:logs:review
npm run security:sample-observability-logs
set -a && . ./.env && set +a && npm run security:red-team:test
```
