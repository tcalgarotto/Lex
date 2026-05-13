import { prisma } from "@/lib/prisma";
import { computeProcessHealth } from "@/lib/legal-processes/process-health";

export async function buildProcessCopilotBrief(args: {
  workspaceId: string;
  legalProcessId: string;
}) {
  const process = await prisma.legalProcess.findFirst({
    where: { id: args.legalProcessId, workspaceId: args.workspaceId },
    include: {
      movements: { orderBy: { dataHora: "desc" }, take: 12 },
      alerts: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 8 },
      case: { select: { id: true, title: true, summary: true } },
    },
  });
  if (!process) throw new Error("Processo DataJud não encontrado.");

  const health = await computeProcessHealth(args);
  const recommendations = [
    process.alerts.length > 0
      ? "Revisar alertas abertos antes de preparar qualquer manifestação."
      : "Sem alertas abertos no momento.",
    health.status === "sync_error"
      ? "Corrigir a conexão DataJud ou tentar nova sincronização manual."
      : "Conferir a última movimentação no painel antes de agir.",
    "Não tratar DataJud como intimação oficial, autos completos ou prazo processual definitivo.",
  ];

  return {
    process: {
      id: process.id,
      cnj: process.cnjFormatted,
      tribunal: process.tribunalAcronym,
      classe: process.classeNome,
      orgaoJulgador: process.orgaoJulgadorNome,
      case: process.case,
    },
    health,
    latestMovements: process.movements.map((movement) => ({
      id: movement.id,
      nome: movement.nome,
      category: movement.category,
      dataHora: movement.dataHora,
    })),
    openAlerts: process.alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      createdAt: alert.createdAt,
    })),
    recommendations,
    guardrails: [
      "Dados DataJud são públicos e podem ter atraso.",
      "Prazos, intimações e autos exigem conferência humana em fonte oficial.",
      "Conectores MNI/Escritório Digital só devem operar com autorização oficial.",
    ],
  };
}
