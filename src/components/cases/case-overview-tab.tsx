"use client";

import Link from "next/link";
import { ArrowRight, FileText, Search, Sparkles, ScrollText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import type {
  Case,
  CaseDraft,
  CaseFact,
  CaseLegalSource,
  CaseParty,
  CaseRequest,
  CaseRisk,
  Document,
  Process,
} from "@prisma/client";

type CaseOverview = Case & {
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  risks: CaseRisk[];
  drafts: CaseDraft[];
  legalSources: CaseLegalSource[];
  documents: Pick<Document, "id" | "originalName" | "status" | "updatedAt">[];
  process: Pick<Process, "id" | "number" | "title" | "tribunal" | "vara"> | null;
};

interface CaseOverviewTabProps {
  caseData: CaseOverview;
  /**
   * Permite ao componente pai sinalizar a aba alvo. As âncoras (#docs,
   * #facts, #research, #strategy) funcionam dentro das `<TabsTrigger>` do
   * Radix se o pai trocar `defaultValue`. Para evitar acoplar ao Radix,
   * este callback simplesmente seleciona a aba via id (definido no page).
   */
  onGoToTab?: (tab: "documents" | "facts" | "research" | "strategy") => void;
}

interface NextStep {
  label: string;
  /** Tom visual do step (ok=feito, alerta=pendente urgente, info=normal). */
  tone: "info" | "warning";
  action?:
    | { kind: "tab"; target: "documents" | "facts" | "research" | "strategy" }
    | { kind: "link"; href: string };
}

export function CaseOverviewTab({ caseData: c, onGoToTab }: CaseOverviewTabProps) {
  const docsReady = c.documents.filter((d) => d.status === "INDEXED").length;
  const docsStalled = c.documents.filter(
    (d) => deriveDocumentDisplayStatus(d).stalled,
  ).length;
  const hasFacts = c.facts.length > 0;
  const hasRequests = c.requests.length > 0;
  const hasResearch = c.legalSources.length > 0;
  const hasDraft = c.drafts.length > 0;

  const steps: NextStep[] = [];
  if (docsStalled > 0) {
    steps.push({
      label: `${docsStalled} documento(s) travado(s) — reprocessar`,
      tone: "warning",
      action: { kind: "tab", target: "documents" },
    });
  }
  if (c.documents.length === 0) {
    steps.push({
      label: "Enviar primeiro documento ao caso",
      tone: "info",
      action: { kind: "tab", target: "documents" },
    });
  } else if (docsReady > 0 && !hasFacts) {
    steps.push({
      label: `Extrair fatos dos ${docsReady} documento(s) prontos`,
      tone: "info",
      action: { kind: "tab", target: "facts" },
    });
  } else if (hasFacts && !hasRequests) {
    steps.push({
      label: "Adicionar pedidos / consolidar partes",
      tone: "info",
      action: { kind: "tab", target: "facts" },
    });
  }
  if (hasFacts && !hasResearch) {
    steps.push({
      label: "Pesquisar fundamentos jurídicos aplicáveis",
      tone: "info",
      action: { kind: "tab", target: "research" },
    });
  }
  if (hasFacts && hasRequests && !hasDraft) {
    steps.push({
      label: "Gerar estratégia inicial e primeira minuta",
      tone: "info",
      action: { kind: "link", href: `/strategy?caseId=${c.id}` },
    });
  } else if (hasDraft) {
    steps.push({
      label: "Revisar última minuta gerada",
      tone: "info",
      action: { kind: "tab", target: "strategy" },
    });
  }

  function clickStep(s: NextStep) {
    if (!s.action) return;
    if (s.action.kind === "tab" && onGoToTab) onGoToTab(s.action.target);
  }

  return (
    <div className="space-y-4">
      {c.summary ? (
        <Card className="p-4 text-sm leading-relaxed text-muted-foreground">{c.summary}</Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <StatBlock
          label="Documentos"
          value={`${c.documents.length}`}
          hint={`${docsReady} prontos${docsStalled ? ` · ${docsStalled} travados` : ""}`}
          icon={<FileText className="size-4" />}
          tone={docsStalled > 0 ? "warning" : c.documents.length === 0 ? "muted" : "ok"}
        />
        <StatBlock
          label="Fatos / Partes / Pedidos"
          value={`${c.facts.length} / ${c.parties.length} / ${c.requests.length}`}
          hint={`${c.risks.length} riscos sinalizados`}
          icon={<Sparkles className="size-4" />}
          tone={hasFacts ? "ok" : "muted"}
        />
        <StatBlock
          label="Pesquisa & Peças"
          value={`${c.legalSources.length} / ${c.drafts.length}`}
          hint={`fundamentos pinados / minutas`}
          icon={<ScrollText className="size-4" />}
          tone={hasDraft ? "ok" : hasResearch ? "info" : "muted"}
        />
      </div>

      {c.process ? (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Processo judicial vinculado
              </p>
              <p className="font-mono text-sm">{c.process.number}</p>
              {c.process.title ? (
                <p className="text-xs text-muted-foreground">{c.process.title}</p>
              ) : null}
              <div className="flex flex-wrap gap-1 pt-1">
                {c.process.tribunal ? (
                  <Badge variant="outline" className="text-[10px]">
                    {c.process.tribunal}
                  </Badge>
                ) : null}
                {c.process.vara ? (
                  <Badge variant="outline" className="text-[10px]">
                    {c.process.vara}
                  </Badge>
                ) : null}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/processos/${c.process.id}`}>
                Abrir <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {steps.length > 0 ? (
        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Próximos passos
          </p>
          <ul className="space-y-1.5">
            {steps.map((s) => {
              const inner = (
                <span
                  className={`inline-flex items-center gap-1 ${
                    s.tone === "warning"
                      ? "text-amber-200 hover:text-amber-100"
                      : "text-violet-300 hover:text-violet-200"
                  }`}
                >
                  {s.tone === "warning" ? <AlertTriangle className="size-3" /> : null}
                  {s.label} <ArrowRight className="size-3" />
                </span>
              );
              if (!s.action) return <li key={s.label} className="text-sm">{inner}</li>;
              if (s.action.kind === "link") {
                return (
                  <li key={s.label} className="text-sm">
                    <Link href={s.action.href}>{inner}</Link>
                  </li>
                );
              }
              return (
                <li key={s.label} className="text-sm">
                  <button type="button" onClick={() => clickStep(s)} className="text-left">
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <DocumentUploadButton caseId={c.id} label="Enviar documento" />
        <Button asChild variant="secondary" size="sm">
          <Link href={`/pesquisa-juridica?caseId=${c.id}`}>
            <Search className="mr-1 size-3" /> Pesquisar fundamentos
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/strategy?caseId=${c.id}`}>
            <Sparkles className="mr-1 size-3" /> Gerar estratégia
          </Link>
        </Button>
      </div>
    </div>
  );
}

const TONE_BORDER: Record<"ok" | "info" | "warning" | "muted", string> = {
  ok: "border-emerald-500/20",
  info: "border-violet-500/20",
  warning: "border-amber-500/30",
  muted: "border-white/10",
};

function StatBlock({
  label,
  value,
  hint,
  icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "ok" | "info" | "warning" | "muted";
}) {
  return (
    <Card className={`p-3 ${TONE_BORDER[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
