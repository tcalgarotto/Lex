import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import FundamentalIntakeFormContent from "@/components/cases/fundamental-intake-form";
import { CaseChecklistTab } from "@/components/cases/case-checklist-tab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isFundamentalIntakeStructured,
  parseFundamentalIntakeFromMetadata,
  usesFundamentalIntakeFlow,
} from "@/lib/cases/case-intake-source";
import { loadCaseForWorkspace } from "../_load-case";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

export default async function CaseInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  const meta = c.metadataJson;
  const structured = isFundamentalIntakeStructured(meta);
  const fundamental = usesFundamentalIntakeFlow(meta);
  const parsedForm = parseFundamentalIntakeFromMetadata(meta);

  if (fundamental) {
    if (parsedForm) {
      return (
        <div className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Entrevista fundamental</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {structured
                ? "A entrevista salva foi preservada. Você pode revisar o relato, salvar alterações ou reorganizar partes, fatos, pedidos e riscos com a JustOS AI."
                : "Mesmo formulário da criação do caso, sincronizado com a entrevista salva. Salvar caso ou organizar com JustOS AI atualiza este registo."}
            </p>
          </header>
          <FundamentalIntakeFormContent
            seedCaseId={c.id}
            seedForm={parsedForm}
            mode="embedded"
            intakeAlreadyOrganized={structured}
          />
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Entrevista fundamental</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Este caso está no fluxo fundamental, mas o formulário salvo não pôde ser carregado
            (versão antiga ou dados incompletos).
          </p>
        </header>
        <Card className="p-4 text-sm text-muted-foreground">
          <p>Abra a página de criação com continuação do caso para regravar o rascunho.</p>
          <Button asChild className="mt-4" variant="default" size="sm">
            <Link href={`/cases/new?continue=${c.id}`}>Continuar em criar caso</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Entrevista guiada (legado)</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Casos antigos que ainda usam checklist por modelo. Novos casos usam a entrevista fundamental
          em criar caso.
        </p>
      </header>
      <CaseChecklistTab caseId={c.id} />
    </div>
  );
}
