#!/usr/bin/env tsx
/**
 * Dispara um trace de teste no Langfuse (OTEL + Vercel AI SDK).
 *
 * Uso:
 *   npm run observability:langfuse:smoke
 *
 * Requer no .env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
 * e provedor de IA ativo (ex.: DEEPSEEK_API_KEY).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Sobrescreve env do shell (evita LANGFUSE_* vazias exportadas no terminal). */
function loadEnvFileOverride(path: string): void {
  const file = resolve(process.cwd(), path);
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

if (existsSync(resolve(process.cwd(), ".env"))) {
  loadEnvFileOverride(".env");
}

async function main(): Promise<void> {
  await import("../src/lib/env-normalize");
  const { propagateAttributes } = await import("@langfuse/tracing");
  const { generateText } = await import("ai");
  const { aiTelemetry } = await import("../src/lib/ai/ai-telemetry");
  const { getLanguageModelForLexTask, getProviderOptionsForLexTask } = await import(
    "../src/lib/ai/llm",
  );
  const { isLangfuseOtelEnabled, flushLangfuseOtel, registerLangfuseOtel } = await import(
    "../src/lib/observability/langfuse-otel",
  );

  if (!isLangfuseOtelEnabled()) {
    console.error(
      "✗ Langfuse desligado: defina LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY no .env",
    );
    process.exit(1);
  }

  const host = process.env["LANGFUSE_HOST"]?.trim() || "(default)";
  console.info(`▸ Langfuse host: ${host}`);
  console.info("▸ Registrando OTEL…");
  registerLangfuseOtel();

  console.info("▸ Chamada LLM de smoke (trace: langfuse-smoke-test)…");

  await propagateAttributes(
    {
      traceName: "langfuse-smoke-test",
      userId: "smoke-script",
      tags: ["lex", "smoke", "langfuse-smoke-test"],
      metadata: { source: "scripts/test-langfuse-trace.ts" },
    },
    async () => {
      const { text, usage } = await generateText({
        model: getLanguageModelForLexTask("summary"),
        providerOptions: getProviderOptionsForLexTask("summary"),
        maxOutputTokens: 16,
        temperature: 0,
        prompt: "Responda com uma única palavra: ok",
        experimental_telemetry: aiTelemetry({
          functionId: "langfuse-smoke-test",
          metadata: { smoke: true },
        }),
      });
      console.info(`▸ Resposta: ${text.trim().slice(0, 80)}`);
      console.info(
        `▸ Tokens: in=${usage?.inputTokens ?? "?"} out=${usage?.outputTokens ?? "?"}`,
      );
    },
  );

  console.info("▸ Enviando spans (forceFlush)…");
  await flushLangfuseOtel();
  console.info("✅ Trace enviado. Abra Langfuse → Tracing → filtre por langfuse-smoke-test");
}

main().catch((e: unknown) => {
  console.error("✗ Falha:", e instanceof Error ? e.message : e);
  process.exit(1);
});
