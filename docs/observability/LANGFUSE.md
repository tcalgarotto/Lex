# Langfuse — tracing (Lex)

Integração via **OpenTelemetry** + **Vercel AI SDK** `experimental_telemetry`, conforme [skill Langfuse](https://github.com/langfuse/skills) e [docs Vercel AI SDK](https://langfuse.com/docs/integrations/vercel-ai-sdk).

## Variáveis de ambiente

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com   # ou self-hosted
```

Sem as chaves, telemetria fica desligada (`isLangfuseOtelEnabled()` → `false`).

## Arquitetura

| Arquivo | Função |
|---------|--------|
| `src/instrumentation.ts` | `registerLangfuseOtel()` no boot Node |
| `src/lib/observability/langfuse-otel.ts` | `NodeTracerProvider` + `LangfuseSpanProcessor` |
| `src/lib/ai/ai-telemetry.ts` | Helper `aiTelemetry()` para `generateText` / `streamText` |
| `src/lib/observability/langfuse-tracing.ts` | `withLangfuseRouteContext`, `flushLangfuseTraces` |

Rotas serverless usam `after(() => flushLangfuseTraces())` para enviar spans antes do fim da função.

## Privacidade

- Trace **input** nas rotas: apenas resumos (`queryLen`, `messageCount`, etc.) — não prompt/documento integral.
- O AI SDK envia conteúdo ao OTEL quando telemetria está ativa; revisar traces no painel após habilitar keys.
- Cliente legado `getLangfuse()` em `langfuse.ts` permanece para uso pontual; fluxos principais usam OTEL.

## Validação

### Smoke (CLI, sem UI)

```bash
npm run observability:langfuse:smoke
```

Envia trace `langfuse-smoke-test` com uma chamada LLM mínima. Requer keys Langfuse + provedor de IA (`DEEPSEEK_API_KEY`, etc.).

### Via app

1. Configure `LANGFUSE_*` no `.env` e reinicie `npm run dev`.
2. Dispare chat, minuta ou intake estruturado.
3. Em [us.cloud.langfuse.com](https://us.cloud.langfuse.com) → Traces: nomes `chat`, `draft-generation`, `intake-structuring`, etc., com `userId` / `sessionId` quando aplicável.
