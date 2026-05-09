import Link from "next/link";
import { AlertTriangle, FileText } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  deriveDocumentDisplayStatus,
  type DocumentDisplayKind,
} from "@/lib/documents/status-display";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";

export const dynamic = "force-dynamic";

interface DocumentosPageProps {
  searchParams: Promise<{
    status?: string;
    caseId?: string;
    unlinked?: string;
  }>;
}

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const sp = await searchParams;
  const { workspaceId } = await getWorkspaceContext();

  const where: {
    workspaceId: string;
    status?: string;
    caseId?: string | null;
  } = { workspaceId };
  if (sp.status) where.status = sp.status;
  if (sp.caseId) where.caseId = sp.caseId;
  if (sp.unlinked === "1") where.caseId = null;

  const [documents, cases] = await Promise.all([
    prisma.document.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        progress: true,
        totalChunks: true,
        processedChunks: true,
        updatedAt: true,
        createdAt: true,
        processId: true,
        caseId: true,
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.case.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  const stalledCount = documents.filter(
    (d) => deriveDocumentDisplayStatus(d).stalled,
  ).length;

  return (
    <AppShell title="Documentos">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Documentos</h1>
            <p className="text-sm text-muted-foreground">
              Petições, despachos, contratos e provas que você enviou. Vincule a um caso para que
              apareçam dentro dele.
            </p>
          </div>
          <DocumentUploadButton
            caseId={sp.caseId}
            label={sp.caseId ? "Enviar para o caso" : "Enviar documento"}
          />
        </header>

        <FiltersBar status={sp.status ?? null} unlinked={sp.unlinked === "1"} />

        {stalledCount > 0 ? (
          <Card className="border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            <AlertTriangle className="mr-1 inline size-3" />
            {stalledCount} documento(s) travado(s) há tempo demais. Use o botão &quot;Reprocessar&quot; para
            tentar novamente.
          </Card>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Nenhum documento ainda"
            description="Envie uma petição, despacho, contrato ou prova para começar a análise jurídica."
            fullHeight
          >
            <div className="mt-5 flex justify-center">
              <DocumentUploadButton
                caseId={sp.caseId}
                label={sp.caseId ? "Enviar primeiro documento ao caso" : "Enviar primeiro documento"}
              />
            </div>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => {
              const status = deriveDocumentDisplayStatus(d);
              return (
                <li key={d.id}>
                  <Card className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium">{d.originalName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <StatusChip kind={status.kind} label={status.label} />
                          {d.case ? (
                            <Link
                              href={`/cases/${d.case.id}`}
                              className="text-violet-300 hover:underline"
                            >
                              {d.case.title}
                            </Link>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Sem caso
                            </Badge>
                          )}
                          {d.totalChunks !== null ? (
                            <span>
                              {d.processedChunks ?? 0}/{d.totalChunks} trechos
                            </span>
                          ) : null}
                          <span>
                            Atualizado {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <DocumentRowActions
                        documentId={d.id}
                        processId={d.processId}
                        caseId={d.caseId}
                        cases={cases}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

const KIND_TONE: Record<DocumentDisplayKind, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  progress: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function StatusChip({ kind, label }: { kind: DocumentDisplayKind; label: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${KIND_TONE[kind]}`}>
      {label}
    </Badge>
  );
}

function FiltersBar({ status, unlinked }: { status: string | null; unlinked: boolean }) {
  const items = [
    { label: "Todos", href: "/documentos", active: !status && !unlinked },
    {
      label: "Sem caso",
      href: "/documentos?unlinked=1",
      active: unlinked && !status,
    },
    {
      label: "Prontos",
      href: "/documentos?status=INDEXED",
      active: status === "INDEXED",
    },
    {
      label: "Em processamento",
      href: "/documentos?status=PARSING",
      active: status === "PARSING",
    },
    { label: "Falharam", href: "/documentos?status=FAILED", active: status === "FAILED" },
  ];
  return (
    <nav className="flex flex-wrap gap-1 text-xs">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-md border px-2 py-1 ${
            i.active
              ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
              : "border-white/10 hover:bg-white/5"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
