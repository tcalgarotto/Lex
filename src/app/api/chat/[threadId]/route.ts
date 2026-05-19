import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { ChatRole } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { enforceAiRouteRateLimit } from "@/lib/rate-limit-ai";
import { prisma } from "@/lib/prisma";
import { retrieveContext } from "@/lib/retrieval/hybrid-retriever";
import { loadMemoryBlock } from "@/lib/memory/engine";
import {
  SYSTEM_BASE,
  styleInjection,
  groundingFromChunks,
  chatContextualPrompt,
} from "@/lib/ai/prompts";
import { getChatLanguageModel, getChatModelId, getChatProviderId } from "@/lib/ai/llm";
import { pushHotInteraction } from "@/lib/memory/hot-cache";
import { recordCostEntry } from "@/lib/cost/record";
import { recordObservabilityLog } from "@/lib/observability/record";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import {
  scheduleLangfuseFlush,
  withLangfuseRouteContext,
} from "@/lib/observability/langfuse-tracing";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";
import { evaluateSourceSufficiency } from "@/lib/legal/source-sufficiency";
import { computeConfidence } from "@/lib/legal/confidence";

type ChatMessageInput = { role: string; content: string };

export async function POST(
  req: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  const rl = await enforceAiRouteRateLimit({
    workspaceId,
    userId: user.id,
    routeName: "chat",
    limit: 30,
  });
  if (!rl.ok) return rl.response;

  const body = (await req.json()) as { messages: ChatMessageInput[] };
  const messages = body.messages ?? [];

  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, workspaceId },
    include: { process: true },
  });
  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread não encontrada" }), { status: 404 });
  }

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const query = latestUser?.content ?? "";

  const { chunks } = await retrieveContext({
    workspaceId,
    processId: thread.processId,
    query,
    limit: 10,
    userId: user.id,
  });

  const classification = classifyLegalQuery(query);
  const sourceSufficiency = evaluateSourceSufficiency({
    classification,
    retrievedChunks: chunks,
    processId: thread.processId,
  });
  const confidence = computeConfidence({
    classification,
    retrievedChunks: chunks,
    sourceSufficiency,
  });

  const docIds = [...new Set(chunks.map((c) => c.meta["documentId"]).filter(Boolean))] as string[];
  const docsById = new Map<string, { name: string }>();
  if (docIds.length) {
    const docs = await prisma.document.findMany({
      where: { workspaceId, id: { in: docIds } },
      select: { id: true, originalName: true },
    });
    for (const d of docs) docsById.set(d.id, { name: d.originalName });
  }

  const memory = await loadMemoryBlock(workspaceId, thread.processId);
  const style = await prisma.styleProfile.findFirst({ where: { workspaceId } });
  const styleBlock = styleInjection(style?.profileJson ?? null);

  const proc = thread.process;
  const processSummary =
    `${proc.number} ${proc.title ?? ""} ${proc.vara ?? ""} ${proc.tribunal ?? ""}`.trim();

  const grounding = groundingFromChunks(chunks);
  const contextual = chatContextualPrompt({
    processSummary,
    memoryBlock: memory,
    styleBlock,
    grounding,
  });

  const formatNormal = `FORMATO OBRIGATÓRIO (responda com estes títulos):
1. Síntese objetiva
2. Leitura do documento/processo
3. Fundamentação localizada (com [fonte:N] quando usar FONTES; se não houver, diga explicitamente)
4. Risco ou ponto de atenção
5. Providência recomendada
6. Fontes utilizadas (liste os [fonte:N] efetivamente citados)`;

  const formatInsufficient = `FORMATO OBRIGATÓRIO (BASE INSUFICIENTE):
1. Limitação da resposta
2. O que é possível inferir (apenas orientação geral/hipóteses; sem afirmar artigos/prazos/precedentes)
3. Fontes/documentos necessários (o que falta para concluir)
4. Próxima ação sugerida`;

  const guardrailHard = sourceSufficiency.sufficient
    ? ""
    : `REGRA DURA: Você DEVE começar a resposta com a frase exata:
"Não localizei fonte suficiente na base indexada para afirmar isso com segurança."
Depois disso, é PROIBIDO afirmar artigo, prazo, súmula, precedente, tribunal, recurso cabível ou consequência processual como verdade confirmada.`;

  const responseFormat = sourceSufficiency.sufficient ? formatNormal : `${guardrailHard}\n\n${formatInsufficient}`;

  if (latestUser?.content) {
    await prisma.chatMessage.create({
      data: {
        threadId,
        role: ChatRole.USER,
        content: latestUser.content,
      },
    });
  }

  scheduleLangfuseFlush();

  const tLlm = Date.now();
  const citations = chunks.map((c, i) => {
    const docId = c.meta["documentId"];
    const docName = docId ? docsById.get(docId)?.name : undefined;
    const section = c.meta["section"];
    const score = c.score;
    const href =
      docId && thread.processId ? `/processos/${thread.processId}/documentos/${docId}` : undefined;

    const typeLabel =
      c.sourceType === "process_document"
        ? "documento do processo"
        : c.sourceType === "legislation"
          ? "legislação"
          : c.sourceType === "jurisprudence"
            ? "jurisprudência"
            : c.sourceType === "process_memory"
              ? "memória do processo"
              : c.sourceType === "legal_piece"
                ? "peça anterior"
                : "fonte";

    const label = docName ? `${docName}` : c.sourceLabel;

    return {
      ref: i + 1,
      label,
      type: typeLabel,
      section: section ?? null,
      excerpt: c.text.slice(0, 280),
      score: typeof score === "number" ? Number(score.toFixed(4)) : null,
      href: href ?? null,
    };
  });

  return await withLangfuseRouteContext(
    {
      traceName: "chat",
      userId: user.id,
      sessionId: threadId,
      workspaceId,
      processId: thread.processId ?? undefined,
      inputSummary: latestUser?.content
        ? JSON.stringify({ queryLen: latestUser.content.length, messageCount: messages.length })
        : undefined,
    },
    async () => {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({
        type: "message-metadata",
        messageMetadata: {
          annotations: [
            { type: "citations", citations },
            {
              type: "confidence",
              label: confidence.label,
              score: Number(confidence.score.toFixed(3)),
              justification: confidence.justification,
            },
            {
              type: "source_sufficiency",
              sufficient: sourceSufficiency.sufficient,
              level: sourceSufficiency.level,
              reasons: sourceSufficiency.reasons,
              warnings: sourceSufficiency.warnings,
              queryType: classification.queryType,
              requiresStrongSources: classification.requiresStrongSources,
            },
          ],
        },
      });

      const result = streamText({
        model: getChatLanguageModel(),
        system: `${SYSTEM_BASE}\n\n${responseFormat}\n\nSINAIS: ${classification.signals.join(", ") || "(nenhum)"}\n\n${contextual}`,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        experimental_telemetry: aiTelemetry({
          functionId: "chat-stream",
          metadata: {
            workspaceId,
            threadId,
            processId: thread.processId ?? "",
          },
        }),
        onFinish: async (event) => {
          const text = event.text;
          const usage = event.totalUsage;
          const promptTokens = usage?.inputTokens;
          const completionTokens = usage?.outputTokens;
          const totalTokens = usage?.totalTokens;

          recordObservabilityLog({
            workspaceId,
            userId: user.id,
            kind: "llm.chat_stream",
            name: "chat",
            latencyMs: Date.now() - tLlm,
            payloadJson: {
              model: getChatModelId(),
              provider: getChatProviderId(),
              promptTokens,
              completionTokens,
            },
            retrievalChunkIds: chunks.map((c) => c.id),
          });

          recordCostEntry({
            workspaceId,
            userId: user.id,
            category: "CHAT_COMPLETION",
            provider: getChatProviderId(),
            model: getChatModelId(),
            promptTokens,
            completionTokens,
            totalTokens,
            metaJson: { threadId, processId: thread.processId },
          });

          await pushHotInteraction({
            workspaceId,
            processId: thread.processId,
            userMessage: latestUser?.content ?? "",
            assistantText: text,
          });

          await prisma.chatMessage.create({
            data: {
              threadId,
              role: ChatRole.ASSISTANT,
              content: text,
              citationsJson: citations,
            },
          });
          await prisma.activity.create({
            data: {
              workspaceId,
              kind: "chat.message",
              title: "Resposta IA no processo",
              metaJson: { processId: thread.processId, threadId },
            },
          });
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
    },
  );
}
