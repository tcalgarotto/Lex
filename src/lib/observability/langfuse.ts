import { Langfuse } from "langfuse";

let client: Langfuse | null | undefined;

/** Inicialização lazy: não exige Langfuse no `getEnv()` para não bloquear o app. */
export function getLangfuse(): Langfuse | null {
  if (client !== undefined) return client;
  const publicKey = process.env["LANGFUSE_PUBLIC_KEY"];
  const secretKey = process.env["LANGFUSE_SECRET_KEY"];
  if (!publicKey?.trim() || !secretKey?.trim()) {
    client = null;
    return client;
  }
  try {
    client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env["LANGFUSE_HOST"]?.trim() || "https://cloud.langfuse.com",
    });
  } catch {
    client = null;
  }
  return client;
}
