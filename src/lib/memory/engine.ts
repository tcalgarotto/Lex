import { prisma } from "@/lib/prisma";

export async function loadMemoryBlock(workspaceId: string, processId?: string): Promise<string> {
  const rows = await prisma.memoryEntry.findMany({
    where: {
      workspaceId,
      ...(processId ? { processId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });
  if (rows.length === 0) return "(sem memória estruturada ainda)";
  return rows
    .map((r) => `- [${r.kind}] ${r.title ? `${r.title}: ` : ""}${r.content}`)
    .join("\n");
}
