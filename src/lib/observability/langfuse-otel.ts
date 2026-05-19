import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

let registered = false;
let langfuseSpanProcessor: LangfuseSpanProcessor | null = null;

function langfuseBaseUrl(): string | undefined {
  return (
    process.env["LANGFUSE_HOST"]?.trim() ||
    process.env["LANGFUSE_BASE_URL"]?.trim() ||
    undefined
  );
}

/** Processor lazy — criado após env carregado (evita US/EU errado e keys vazias do shell). */
export function getLangfuseSpanProcessor(): LangfuseSpanProcessor {
  if (!langfuseSpanProcessor) {
    const baseUrl = langfuseBaseUrl();
    langfuseSpanProcessor = new LangfuseSpanProcessor(
      baseUrl ? { baseUrl } : undefined,
    );
  }
  return langfuseSpanProcessor;
}

export function isLangfuseOtelEnabled(): boolean {
  return Boolean(
    process.env["LANGFUSE_PUBLIC_KEY"]?.trim() && process.env["LANGFUSE_SECRET_KEY"]?.trim(),
  );
}

/**
 * Registra OpenTelemetry com Langfuse (Vercel AI SDK telemetry).
 * Chamar após carregar variáveis de ambiente (instrumentation.ts).
 */
export function registerLangfuseOtel(): void {
  if (registered || !isLangfuseOtelEnabled()) return;

  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [getLangfuseSpanProcessor()],
  });
  tracerProvider.register();
  registered = true;
}

export async function flushLangfuseOtel(): Promise<void> {
  if (!isLangfuseOtelEnabled()) return;
  await getLangfuseSpanProcessor().forceFlush();
}
