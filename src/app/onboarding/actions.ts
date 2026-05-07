"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const STYLE_PRESETS: Record<
  string,
  { formalidade: string; doutrina: string; jurisprudencia: string; tom: string }
> = {
  tecnico_objetivo: {
    formalidade: "média",
    doutrina: "baixa",
    jurisprudencia: "moderada",
    tom: "técnico e objetivo",
  },
  tecnico_robusto: {
    formalidade: "alta",
    doutrina: "moderada",
    jurisprudencia: "frequente",
    tom: "técnico e robusto",
  },
  altamente_formal: {
    formalidade: "muito alta",
    doutrina: "moderada",
    jurisprudencia: "moderada",
    tom: "altamente formal",
  },
  combativo: {
    formalidade: "alta",
    doutrina: "baixa",
    jurisprudencia: "frequente",
    tom: "combativo",
  },
  conciliador: {
    formalidade: "média",
    doutrina: "baixa",
    jurisprudencia: "moderada",
    tom: "conciliador",
  },
};

export async function completeOnboardingAction(formData: FormData) {
  const { workspaceId, user } = await getWorkspaceContext();

  const lawyerName = String(formData.get("lawyerName") ?? "").trim();
  const officeName = String(formData.get("officeName") ?? "").trim();
  const areas = String(formData.get("areas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const stylePreset = String(formData.get("stylePreset") ?? "tecnico_robusto");

  const preset = STYLE_PRESETS[stylePreset] ?? STYLE_PRESETS["tecnico_robusto"];

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: officeName || undefined,
      onboardingCompleted: true,
      onboardingJson: {
        lawyerName: lawyerName || null,
        officeName: officeName || null,
        practiceAreas: areas,
        stylePreset,
        completedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { name: lawyerName || undefined },
  });

  await prisma.styleProfile.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    create: {
      workspaceId,
      userId: user.id,
      profileJson: preset as unknown as Prisma.InputJsonValue,
      recurringPhrases: stylePreset === "altamente_formal" ? ["Com a devida vênia,", "Data venia,"] : [],
      metricsJson: { preset: stylePreset },
    },
    update: {
      profileJson: preset as unknown as Prisma.InputJsonValue,
      metricsJson: { preset: stylePreset },
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "onboarding.completed",
      title: "Onboarding concluído",
      metaJson: { stylePreset, practiceAreas: areas },
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

