import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Prisma } from "@prisma/client";
import { DocumentStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officePrivateDocumentsAndParts } from "@/lib/documents/office-list-filter";
import {
  deriveDocumentDisplayStatus,
  type DocumentDisplayKind,
} from "@/lib/documents/status-display";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { lexPageLeadClassName, lexPageTitleClassName } from "@/lib/lex-ds";

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
  const { workspaceId, user } = await getWorkspaceContext();

  const andParts: Prisma.DocumentWhereInput[] = [...officePrivateDocumentsAndParts(user.id)];
  if (sp.status && (Object.values(DocumentStatus) as string[]).includes(sp.status)) {
    andParts.push({ status: sp.status as DocumentStatus });
  }
  if (sp.caseId) andParts.push({ caseId: sp.caseId });
  if (sp.unlinked === "1") andParts.push({ caseId: null });

  const [documents, cases] = await Promise.all([
    prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        archivedAt: null,
        AND: andParts,
      },
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

  const stalledCount = documents.filter((d) => deriveDocumentDisplayStatus(d).stalled).length;

  return (
    <>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <h1 className={lexPageTitleClassName}>Documentos</h1>
            <p className={lexPageLeadClassName}>
              Petições, despachos, contratos e provas carregados neste workspace. Associe a um caso para
              integrarem o contexto dele.
            </p>
          </div>
          <DocumentUploadButton
            caseId={sp.caseId}
            label={sp.caseId ? "Enviar para o caso" : "Enviar documento"}
            ctaGlass
          />
        </header>

        <FiltersBar status={sp.status ?? null} unlinked={sp.unlinked === "1"} />

        {stalledCount > 0 ? (
          <div
            className="lex-glass-card flex flex-wrap items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
            <p className="min-w-0 flex-1 leading-relaxed">
              {stalledCount} documento(s) travado(s) há tempo demais. Use o botão &quot;Reprocessar&quot; para
              tentar novamente.
            </p>
          </div>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            className="w-full min-w-0"
            icon={<FileText className="size-5" />}
            title="Nenhum documento ainda"
            description="Carregue petições, despachos, contratos ou provas para indexação e uso nas ferramentas do Lex."
            fullHeight
          >
            <div className="mt-5 flex justify-center">
              <DocumentUploadButton
                caseId={sp.caseId}
                label={sp.caseId ? "Enviar primeiro documento ao caso" : "Enviar primeiro documento"}
                ctaGlass
              />
            </div>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-5">
            {documents.map((d) => {
              const status = deriveDocumentDisplayStatus(d);
              const updated = formatDistanceToNow(d.updatedAt, { addSuffix: true, locale: ptBR });
              return (
                <li key={d.id}>
                  <article className="lex-glass-card group relative flex flex-col overflow-hidden rounded-2xl p-4 md:p-5 lex-transition">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusChip kind={status.kind} label={status.label} />
                          {d.case ? (
                            <Link
                              href={`/cases/${d.case.id}`}
                              className="text-[13px] font-medium text-violet-300 hover:underline"
                            >
                              {d.case.title}
                            </Link>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="border-[0.5px] border-[color:var(--border-default)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]"
                            >
                              Sem caso
                            </Badge>
                          )}
                        </div>
                        <h2 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight text-[color:var(--text-primary)] md:text-lg">
                          {d.originalName}
                        </h2>
                      </div>
                      <div className="shrink-0">
                        <DocumentRowActions
                          documentId={d.id}
                          processId={d.processId}
                          caseId={d.caseId}
                          cases={cases}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-1 border-t border-[color:var(--border-subtle)] pt-3 text-[13px] text-[color:var(--text-muted)]">
                      <p className="leading-snug">
                        {d.totalChunks !== null ? (
                          <span className="text-[color:var(--text-secondary)]">
                            {d.processedChunks ?? 0}/{d.totalChunks} trechos
                          </span>
                        ) : null}
                        {d.totalChunks !== null ? (
                          <span className="mx-1.5 text-[color:var(--border-default)]">·</span>
                        ) : null}
                        <span>Atualizado {updated}</span>
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
    </>
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
    <Badge
      variant="outline"
      className={`border-[0.5px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${KIND_TONE[kind]}`}
    >
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
    <div className="lex-glass-card rounded-2xl p-4 md:p-5">
      <nav className="flex flex-wrap gap-2" aria-label="Filtros de documentos">
        {items.map((i) => (
          <Button
            key={i.href}
            asChild
            type="button"
            variant={i.active ? "secondary" : "outline"}
            className="h-11 min-h-[44px] text-[15px] font-medium"
          >
            <Link href={i.href}>{i.label}</Link>
          </Button>
        ))}
      </nav>
    </div>
  );
}
