import { NonRetriableError } from "inngest";
import { MemoryKind } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { generateText } from "ai";
import { getChatLanguageModel } from "@/lib/ai/llm";

export const summarizeProcessMemory = inngest.createFunction(
  { id: "summarize-memory", retries: 2 },
  { event: "lex/memory.summarize" },
  async ({ event, step }) => {
    const { workspaceId, processId, threadId } = event.data;

    const proc = await step.run("load-process", () =>
      prisma.process.findFirst({ where: { id: processId, workspaceId } }),
    );
    if (!proc) throw new NonRetriableError("Processo não encontrado");

    const recent = await step.run("load-messages", () =>
      prisma.chatMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    );

    const transcript = recent
      .reverse()
      .map((m) => `${m.role}: ${m.content.slice(0, 2000)}`)
      .join("\n");

    const { text } = await step.run("llm-summarize", () =>
      generateText({
        model: getChatLanguageModel(),
        maxTokens: 600,
        temperature: 0.2,
        prompt: `Extraia fatos jurídicos estáveis e estratégia em bullet points curtos, sem inventar. Se faltar dado, omita.\n\n${transcript}`,
      }),
    );

    await step.run("persist", () =>
      prisma.memoryEntry.create({
        data: {
          workspaceId,
          processId,
          kind: MemoryKind.PROCESS,
          title: "Resumo assistido (chat)",
          content: text,
        },
      }),
    );

    return { ok: true };
  },
);
