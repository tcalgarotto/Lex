import { streamText } from "ai";
import { getWorkspaceContext } from "@/lib/auth/session";
import { enforceAiRouteRateLimit } from "@/lib/rate-limit-ai";
import {
  SYSTEM_BASE,
  styleInjection,
  groundingFromChunks,
  EDITOR_REWRITE,
} from "@/lib/ai/prompts";
import { retrieveContext } from "@/lib/retrieval/hybrid-retriever";
import { prisma } from "@/lib/prisma";
import { getChatLanguageModel } from "@/lib/ai/llm";

type Body = {
  action: "continue" | "fundamentar" | "jurisprudencia" | "estilo";
  selection: string;
  processId?: string;
};

const actionHints: Record<Body["action"], string> = {
  continue: "Continue o texto a partir do trecho, mantendo coerência e tom jurídico.",
  fundamentar: "Melhore a fundamentação jurídica do trecho, citando [fonte:N] quando usar FONTES.",
  jurisprudencia:
    "Enriqueça o trecho com referência a jurisprudência das FONTES; se não houver fonte de jurisprudência, diga que não há base recuperada.",
  estilo: EDITOR_REWRITE,
};

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const rl = await enforceAiRouteRateLimit({
    workspaceId,
    userId: user.id,
    routeName: "completion",
    limit: 24,
  });
  if (!rl.ok) return rl.response;

  const body = (await req.json()) as Body;
  const action = body.action ?? "continue";
  const selection = body.selection ?? "";

  const { chunks } = await retrieveContext({
    workspaceId,
    processId: body.processId,
    query: selection.slice(0, 2000),
    limit: 8,
    userId: user.id,
  });

  const style = await prisma.styleProfile.findFirst({ where: { workspaceId } });
  const styleBlock = styleInjection(style?.profileJson ?? null);
  const grounding = groundingFromChunks(chunks);

  const result = streamText({
    model: getChatLanguageModel(),
    system: `${SYSTEM_BASE}\n${styleBlock}\n\n${grounding}\n\nTarefa: ${actionHints[action]}`,
    prompt: `Trecho do documento:\n\n${selection}`,
  });

  return result.toTextStreamResponse();
}
