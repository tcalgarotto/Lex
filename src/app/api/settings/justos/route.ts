/**
 * GET/PATCH configuração JustOS do workspace ativo (`onboardingJson.justos`).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  mergeJustosWorkspaceConfig,
  readJustosWorkspaceConfig,
} from "@/lib/justos/workspace-config";
import { syncWorkspaceLawyerWhatsAppToAllCases } from "@/lib/justos/n8n-secretary-store";
import { readJustosN8nServiceToken, readJustosN8nWebhookUrl } from "@/lib/justos/env";
import { normalizeJustosPhoneList } from "@/lib/justos/phone-normalize";

const PatchBody = z.object({
  enabled: z.boolean().optional(),
  proEnabled: z.boolean().optional(),
  officePhone: z.string().max(32).optional().nullable(),
  lawyerWhatsApp: z.array(z.string()).optional(),
  n8nHealthUrl: z.string().url().optional().nullable(),
});

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  const config = readJustosWorkspaceConfig(ws?.onboardingJson);
  return NextResponse.json({
    config,
    webhookConfigured: Boolean(readJustosN8nWebhookUrl()),
    serviceTokenConfigured: Boolean(readJustosN8nServiceToken()),
  });
}

export async function PATCH(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  const current = readJustosWorkspaceConfig(ws?.onboardingJson);
  const patch = {
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.proEnabled !== undefined ? { proEnabled: body.proEnabled } : {}),
    ...(body.officePhone !== undefined
      ? { officePhone: body.officePhone ?? undefined }
      : {}),
    ...(body.n8nHealthUrl !== undefined
      ? { n8nHealthUrl: body.n8nHealthUrl ?? undefined }
      : {}),
    ...(body.lawyerWhatsApp !== undefined
      ? { lawyerWhatsApp: normalizeJustosPhoneList(body.lawyerWhatsApp) }
      : {}),
  };

  if (patch.proEnabled && !(patch.enabled ?? current.enabled)) {
    return NextResponse.json(
      { error: "Ative o JustOS antes do JustOS Pro." },
      { status: 400 },
    );
  }

  const onboardingJson = mergeJustosWorkspaceConfig(ws?.onboardingJson, patch);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  let syncedCaseIds: string[] = [];
  const lawyers = readJustosWorkspaceConfig(onboardingJson).lawyerWhatsApp;
  if (body.lawyerWhatsApp !== undefined && lawyers?.length) {
    syncedCaseIds = await syncWorkspaceLawyerWhatsAppToAllCases(workspaceId, lawyers);
  }

  return NextResponse.json({
    config: readJustosWorkspaceConfig(onboardingJson),
    syncedCaseIds,
    syncedCaseId: syncedCaseIds[0],
  });
}
