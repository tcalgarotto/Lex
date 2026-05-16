import { NextResponse } from "next/server";
import { requireBetaLeadsAdmin } from "@/lib/auth/beta-leads-admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireBetaLeadsAdmin();

  const leads = await prisma.betaLeadRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      role: true,
      teamSize: true,
      mainPain: true,
      intent: true,
      status: true,
      source: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      referrer: true,
      notes: true,
      contactedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ leads });
}
