# DeepSeek — provedor Lex AI (V4)

## Modelos

| Papel | Model ID default | Env override |
|-------|------------------|--------------|
| Rápido (Flash) | `deepseek-v4-flash` | `DEEPSEEK_MODEL_FAST` |
| Pro | `deepseek-v4-pro` | `DEEPSEEK_MODEL_PRO` |
| Default operacional | Flash | `DEEPSEEK_MODEL_DEFAULT` |

`deepseek-chat` e `deepseek-reasoner` são legado/compatibilidade — **não** são default do Lex.

## Roteamento por tarefa (`LexAiTask`)

**Flash:** `intake_structuring`, `classification`, `summary`, `case_brain`, `legal_research_suggestions`, `chat`, `fallback`

**Pro (+ thinking quando suportado):** `strategy`, `draft_generation`, `draft_review`

Implementação: `src/lib/ai/deepseek-model-router.ts`, `src/lib/ai/deepseek-provider.ts`

## Variáveis de ambiente

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL_FAST=deepseek-v4-flash
DEEPSEEK_MODEL_PRO=deepseek-v4-pro
DEEPSEEK_MODEL_DEFAULT=deepseek-v4-flash
DEEPSEEK_ENABLE_THINKING_FOR_PRO=true
DEEPSEEK_REASONING_EFFORT_DEFAULT=high
```

Pesquisa jurídica (modo DeepSeek HTTP direto): `DEEPSEEK_MODEL` ainda aceito; se ausente, usa `DEEPSEEK_MODEL_FAST` ou `deepseek-v4-flash`.

## Pacote

- `ai@6` + `@ai-sdk/deepseek` (`createDeepSeek`) — spec v2+
- **Não** usar `createOpenAI({ name: "deepseek" })` — gera `LanguageModelV1` e quebra no AI SDK 6.

## Erros (UI)

`normalizeAiProviderError` em `src/lib/ai/normalize-ai-error.ts` — mensagens amigáveis, sem stack técnica, sem PII, sem API key.

## Logs

Apenas `code`, `task`, `modelId`, `hint` — nunca prompt completo nem dados do cliente.
