import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseProcessTab } from "@/components/cases/case-process-tab";
import { loadCaseLinkedProcesses } from "@/lib/cases/load-case-linked-processes";
import { loadCaseForWorkspace } from "../_load-case";

export default async function CaseProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  const legalProcesses = await loadCaseLinkedProcesses(workspaceId, id);

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Processo vinculado</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Opcional. Vincule CNJ, tribunal e vara somente quando já existir processo judicial — o caso
          pode existir antes disso.
        </p>
      </header>
      <CaseProcessTab caseId={c.id} caseRecord={c} legalProcesses={legalProcesses} />
    </div>
  );
}
