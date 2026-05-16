/**
 * Rate limit para rotas de IA (LLM / RAG / embeddings via API).
 * Sempre roda **antes** de chamar o provider.
 */

import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import {
  rateLimit,
  rateLimitHeaders,
  rateLimitHttpStatus,
  getRequestIp,
  type RateLimitResult,
} from "@/lib/rate-limit";

const log = getLogger("lex.rate-limit.ai");

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_SEC = 60;

export function aiRateLimitKey(workspaceId: string, userId: string, routeName: string): string {
  return `ai:${workspaceId}:${userId}:${routeName}`;
}

export function aiRateLimitKeyAnonymous(routeName: string, req: Request): string {
  return `ai:anon:${getRequestIp(req.headers)}:${routeName}`;
}

export async function enforceAiRouteRateLimit(args: {
  workspaceId: string;
  userId: string;
  routeName: string;
  limit?: number;
  windowSeconds?: number;
}): Promise<{ ok: true; result: RateLimitResult; headers: Record<string, string> } | { ok: false; response: NextResponse }> {
  const limit = args.limit ?? DEFAULT_LIMIT;
  const windowSeconds = args.windowSeconds ?? DEFAULT_WINDOW_SEC;
  const key = aiRateLimitKey(args.workspaceId, args.userId, args.routeName);
  const result = await rateLimit({ key, limit, windowSeconds, tier: "expensive" });

  const headers = rateLimitHeaders(result);

  if (!result.allowed) {
    log.warn("ai rate limit blocked", {
      route: args.routeName,
      workspaceId: args.workspaceId,
      userId: args.userId,
      source: result.source,
    });
    const status = rateLimitHttpStatus(result);
    const message =
      status === 503
        ? "Serviço de IA temporariamente indisponível. Tente novamente em instantes."
        : "Muitas solicitações de IA. Aguarde um minuto.";
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status, headers }),
    };
  }

  return { ok: true, result, headers };
}
