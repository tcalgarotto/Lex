/**
 * POST /api/settings/justos/subscribe — assina JustOS Pro (OWNER) via Asaas Sandbox.
 * DELETE /api/settings/justos/subscribe — cancela Pro (OWNER).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  cancelJustosProForWorkspace,
  subscribeJustosProForWorkspace,
  subscribeJustosProForceNew,
} from "@/lib/justos/justos-pro-checkout";
import { readJustosWorkspaceConfig } from "@/lib/justos/workspace-config";

const SubscribeBody = z.object({
  cycle: z.enum(["monthly", "yearly"]),
  forceNew: z.boolean().optional(),
  paymentMethod: z.enum(["pix", "credit_card"]).optional(),
});

export async function POST(req: Request) {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json(
      { error: "Apenas o titular do escritório pode assinar o JustOS Pro." },
      { status: 403 },
    );
  }

  let body: z.infer<typeof SubscribeBody>;
  try {
    body = SubscribeBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  try {
    const subscribeArgs = {
      workspaceId,
      cycle: body.cycle,
      paymentMethod: body.paymentMethod,
    };
    const result = body.forceNew
      ? await subscribeJustosProForceNew(subscribeArgs)
      : await subscribeJustosProForWorkspace(subscribeArgs);
    return NextResponse.json({
      ok: true,
      config: result.config,
      message: result.message,
      paymentId: result.paymentId ?? null,
      paymentUrl: result.paymentUrl ?? null,
      pendingPayment: result.pendingPayment ?? false,
      reused: result.reused ?? false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar assinatura.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function DELETE() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json({ error: "Apenas o titular pode cancelar." }, { status: 403 });
  }

  const result = await cancelJustosProForWorkspace(workspaceId);

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    accessUntil: result.accessUntil,
    config: readJustosWorkspaceConfig(ws?.onboardingJson),
  });
}
