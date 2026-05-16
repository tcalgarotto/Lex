import { generateText, streamText } from "ai";
import { getWorkspaceContext } from "@/lib/auth/session";
import { enforceAiRouteRateLimit } from "@/lib/rate-limit-ai";
import { prisma } from "@/lib/prisma";
import { retrieveContext } from "@/lib/retrieval/hybrid-retriever";
import { loadMemoryBlock } from "@/lib/memory/engine";
import {
  SYSTEM_BASE,
  styleInjection,
  groundingFromChunks,
  PIECE_OUTLINE,
  PIECE_SECTION,
} from "@/lib/ai/prompts";
import { getPieceLanguageModel } from "@/lib/ai/llm";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";
import { evaluateSourceSufficiency } from "@/lib/legal/source-sufficiency";
import { computeConfidence } from "@/lib/legal/confidence";

type Body = {
  kind: string;
  processId: string;
};

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const rl = await enforceAiRouteRateLimit({
    workspaceId,
    userId: user.id,
    routeName: "generate-piece",
    limit: 12,
  });
  if (!rl.ok) return rl.response;

  const { kind, processId } = (await req.json()) as Body;

  const proc = await prisma.process.findFirst({
    where: { id: processId, workspaceId },
    include: { client: true },
  });
  if (!proc) {
    return new Response(JSON.stringify({ error: "Processo não encontrado" }), { status: 404 });
  }

  const style = await prisma.styleProfile.findFirst({ where: { workspaceId } });
  const styleBlock = styleInjection(style?.profileJson ?? null);
  const memory = await loadMemoryBlock(workspaceId, processId);

  const query = `${kind} ${proc.number} ${proc.title ?? ""}`;
  const { chunks } = await retrieveContext({
    workspaceId,
    processId,
    query,
    limit: 12,
    userId: user.id,
  });
  const grounding = groundingFromChunks(chunks);

  const classification = classifyLegalQuery(`Gerar peça: ${kind}`);
  const sourceSufficiency = evaluateSourceSufficiency({
    classification,
    retrievedChunks: chunks,
    processId,
  });
  const confidence = computeConfidence({
    classification,
    retrievedChunks: chunks,
    sourceSufficiency,
  });

  if (!sourceSufficiency.sufficient) {
    const diagnostic = [
      "Não localizei fonte suficiente na base indexada para afirmar isso com segurança.",
      "",
      "Diagnóstico:",
      ...sourceSufficiency.reasons.map((r) => `- ${r}`),
      ...(sourceSufficiency.warnings.length ? ["", "Alertas:", ...sourceSufficiency.warnings.map((w) => `- ${w}`)] : []),
      "",
      "Checklist para geração segura:",
      "- Anexar/confirmar o despacho/decisão/intimação pertinente.",
      "- Anexar peças relevantes (inicial/contestação) e documentos essenciais.",
      "- Confirmar o objetivo e o pedido concreto da manifestação.",
      "",
      `Confiança: ${confidence.label} — ${confidence.justification}`,
    ].join("\n");
    return new Response(diagnostic, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const { text: outlineRaw } = await generateText({
    model: getPieceLanguageModel(),
    maxOutputTokens: 800,
    temperature: 0.2,
    prompt: `${SYSTEM_BASE}\n\nPeça: ${kind}\nProcesso: ${proc.number}. Cliente: ${proc.client?.name ?? "N/I"}.\nMemória:\n${memory}\n${styleBlock}\n\n${grounding}\n\n${PIECE_OUTLINE}`,
  });

  const result = streamText({
    model: getPieceLanguageModel(),
    system: `${SYSTEM_BASE}\n${styleBlock}\n\n${grounding}\n\nOutline sugerido:\n${outlineRaw}\n\n${PIECE_SECTION}`,
    prompt: `Redija a peça completa: ${kind}. Inclua cabeçalho com qualificação básica quando faltar dado use [●].`,
  });

  return result.toTextStreamResponse();
}
