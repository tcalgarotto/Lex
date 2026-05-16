import Link from "next/link";
import { requireBetaLeadsAdmin } from "@/lib/auth/beta-leads-admin";
import { prisma } from "@/lib/prisma";
import { BetaLeadsAdminTable, type BetaLeadRow } from "@/components/marketing/beta-leads-admin-table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BetaLeadsAdminPage() {
  await requireBetaLeadsAdmin();

  const rows = await prisma.betaLeadRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const leads: BetaLeadRow[] = rows.map((r) => ({
    ...r,
    contactedAt: r.contactedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads — beta e demonstrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitações da landing pública. Dados sensíveis — uso interno comercial apenas.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/admin">← Admin interno</Link>
        </Button>
      </div>
      <BetaLeadsAdminTable initialLeads={leads} />
    </div>
  );
}
