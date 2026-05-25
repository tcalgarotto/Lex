import Link from "next/link";
import { getCrmPipelineBoard } from "@/lib/justos/crm/pipeline-service";
import { isCrmPageAllowed } from "@/lib/justos/crm-page-guard";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CrmPipelineBoard } from "@/components/crm/crm-pipeline-board";
import { CrmProGateEmptyState } from "@/components/crm/crm-pro-gate";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CrmPipelinePage() {
  if (!(await isCrmPageAllowed())) {
    return (
      <div className="p-6">
        <CrmProGateEmptyState />
      </div>
    );
  }

  const { workspaceId } = await getWorkspaceContext();
  const board = await getCrmPipelineBoard(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pipeline CRM</h1>
          <p className="text-sm text-muted-foreground">Arraste estágios pelo seletor em cada cartão</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/crm/contacts">Contatos</Link>
        </Button>
      </div>
      <CrmPipelineBoard stages={board.stages} contactsByStage={board.contactsByStage} />
    </div>
  );
}
