import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CaseDetailRecord } from "@/app/(app)/cases/[id]/_load-case";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";

const chipClass =
  "inline-flex items-center gap-1 rounded-full border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] px-2.5 py-1 text-caption font-medium text-[color:var(--text-primary)] lex-transition hover:border-[color:var(--brand-border)] hover:bg-[color:var(--surface-overlay-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-border)]";

export function CaseCockpitMetricChips({
  caseId,
  caseRecord: c,
  checklistMissingCount,
}: {
  caseId: string;
  caseRecord: CaseDetailRecord;
  checklistMissingCount: number;
}) {
  const docsReady = c.documents.filter((d) => d.status === "INDEXED").length;
  const docsStalled = c.documents.filter((d) => deriveDocumentDisplayStatus(d).stalled).length;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Indicadores do caso">
      {checklistMissingCount > 0 ? (
        <Link
          href={`/cases/${caseId}/entrevista`}
          className={cn(chipClass, "border-[color:var(--warning-border)]/60 text-[color:var(--warning-text)]")}
        >
          {checklistMissingCount} pendência{checklistMissingCount > 1 ? "s" : ""}
        </Link>
      ) : null}
      <Link
        href={`/cases/${caseId}/documentos`}
        className={cn(chipClass, docsStalled > 0 && "border-[color:var(--warning-border)]")}
      >
        Docs {c.documents.length}
        {docsReady > 0 ? <span className="text-[color:var(--text-muted)]"> · {docsReady} ok</span> : null}
        {docsStalled > 0 ? <span className="text-[color:var(--warning-text)]"> · trav.</span> : null}
      </Link>
      <Link href={`/cases/${caseId}/partes-fatos`} className={chipClass}>
        Fatos {c.facts.length}/{c.parties.length}
      </Link>
      <Link href={`/cases/${caseId}/pesquisa-juridica`} className={chipClass}>
        Pesquisa {c.legalSources.length}
      </Link>
      <Link href={`/cases/${caseId}/pecas`} className={chipClass}>
        Peças {c.drafts.length}
      </Link>
    </div>
  );
}
