import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getEnv } from "@/lib/env";
import { cacheGet, cacheSet } from "@/lib/redis";

const MODEL = "BAAI/bge-m3";

function deepinfra() {
  const env = getEnv();
  return createOpenAI({
    apiKey: env.DEEPINFRA_API_KEY,
    baseURL: env.DEEPINFRA_BASE_URL,
  });
}

function cacheKey(text: string): string {
  const h = createHash("sha256").update(text).digest("hex");
  return `emb:${MODEL}:${h}`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const env = getEnv();
  const model = deepinfra().embedding(MODEL);
  const out: number[][] = [];
  const pending: { idx: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t) continue;
    const key = cacheKey(t);
    const cached = await cacheGet(key);
    if (cached) {
      out[i] = JSON.parse(cached) as number[];
    } else {
      pending.push({ idx: i, text: t });
    }
  }

  if (pending.length > 0) {
    const { embeddings } = await embedMany({
      model,
      values: pending.map((p) => p.text),
      maxRetries: 3,
    });
    for (let j = 0; j < pending.length; j++) {
      const { idx, text } = pending[j]!;
      const vec = embeddings[j];
      if (!vec) throw new Error("Embedding ausente");
      out[idx] = vec;
      if (env.NODE_ENV !== "test") {
        await cacheSet(cacheKey(text), JSON.stringify(vec), 86400 * 7);
      }
    }
  }

  return texts.map((_, i) => {
    const v = out[i];
    if (!v) throw new Error("Falha ao embedar texto");
    return v;
  });
}

export async function embedQuery(text: string): Promise<number[]> {
  const vecs = await embedTexts([text]);
  const v = vecs[0];
  if (!v) throw new Error("Falha ao embedar consulta");
  return v;
}
