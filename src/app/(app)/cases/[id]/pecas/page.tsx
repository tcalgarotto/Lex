import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CasePiecesTab } from "@/components/cases/case-pieces-tab";
import { loadCaseForWorkspace } from "../_load-case";

export default async function CasePiecesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Peças e minutas</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Versões geradas, revisões e exportação — sempre no contexto deste caso.
        </p>
      </header>
      <CasePiecesTab caseId={c.id} drafts={c.drafts} reviews={c.reviews} />
    </div>
  );
}
