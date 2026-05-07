import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { analyzePiecesAndUpdateStyle } from "@/lib/ai/style-engine";

export const recomputeStyle = inngest.createFunction(
  { id: "recompute-style", retries: 2 },
  { event: "lex/style.recompute" },
  async ({ event, step }) => {
    const { workspaceId, userId } = event.data;
    const ws = await step.run("check-ws", () => prisma.workspace.findUnique({ where: { id: workspaceId } }));
    if (!ws) throw new NonRetriableError("Workspace inválido");
    await step.run("analyze", () => analyzePiecesAndUpdateStyle({ workspaceId, userId }));
    return { ok: true };
  },
);
