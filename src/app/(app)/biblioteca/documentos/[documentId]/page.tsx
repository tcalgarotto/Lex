import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentLibraryShelf } from "@prisma/client";
import { SetPageTitle } from "@/components/app/set-page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentReadScopeOr } from "@/lib/biblioteca/platform-library";
import { userCanReadDocument } from "@/lib/documents/document-access";
import { LexBibliotecaPdfViewer } from "@/components/biblioteca/lex-biblioteca-pdf-viewer";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import {
  deriveDocumentDisplayStatus,
  type DocumentDisplayKind,
} from "@/lib/documents/status-display";


function shelfLabel(shelf: DocumentLibraryShelf, scope: "workspace" | "lex-platform"): string {
  if (scope === "lex-platform") {
    return shelf === DocumentLibraryShelf.SHARED_LEGAL
      ? "Catálogo Lex (plataforma): leis e normas"
      : "Catálogo Lex (plataforma): livros";
  }
  switch (shelf) {
    case DocumentLibraryShelf.SHARED_LEGAL:
      return "Catálogo: leis e normas";
    case DocumentLibraryShelf.SHARED_BOOKS:
      return "Catálogo: livros";
    default:
      return "Documento da equipa";
  }
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

function isPdf(mimeType: string, name: string): boolean {
  const mt = mimeType.toLowerCase();
  return mt.includes("pdf") || name.toLowerCase().endsWith(".pdf");
}

export default async function BibliotecaDocumentoPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  const readScope = await documentReadScopeOr(workspaceId);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null, OR: readScope },
    select: {
      id: true,
      workspaceId: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      progress: true,
      totalChunks: true,
      processedChunks: true,
      extractedText: true,
      libraryShelf: true,
      uploadedByUserId: true,
      caseId: true,
      processId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!doc || !userCanReadDocument(user.id, doc)) {
    notFound();
  }

  const catalogScope: "workspace" | "lex-platform" =
    doc.workspaceId !== workspaceId &&
    (doc.libraryShelf === DocumentLibraryShelf.SHARED_LEGAL ||
      doc.libraryShelf === DocumentLibraryShelf.SHARED_BOOKS)
      ? "lex-platform"
      : "workspace";

  const [cases] = await Promise.all([
    prisma.case.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  const status = deriveDocumentDisplayStatus(doc);
  const pdf = isPdf(doc.mimeType, doc.originalName);
  const fileUrl = `/api/documents/${doc.id}/file`;
  const downloadUrl = `${fileUrl}?download=1`;

  return (
    <>
      <SetPageTitle title={doc.originalName} />
      <div className="w-full min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href="/biblioteca"
                className="text-muted-foreground underline-offset-2 hover:text-[color:var(--text-primary)] hover:underline"
              >
                Biblioteca
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="truncate font-medium text-[color:var(--text-primary)]">{doc.originalName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {shelfLabel(doc.libraryShelf, catalogScope)}
              </Badge>
              <StatusChip kind={status.kind} label={status.label} />
              <span className="text-xs text-muted-foreground">
                {(doc.sizeBytes / 1024).toFixed(0)} KB · enviado em{" "}
                {doc.createdAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl}>
                Descarregar
              </a>
            </Button>
            {doc.workspaceId === workspaceId ? (
              <DocumentRowActions
                documentId={doc.id}
                processId={doc.processId}
                caseId={doc.caseId}
                cases={cases}
              />
            ) : null}
          </div>
        </div>

        {pdf ? (
          <LexBibliotecaPdfViewer fileUrl={fileUrl} title={doc.originalName} />
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 p-8 text-center text-sm text-[color:var(--text-secondary)]">
            <p className="mb-4">Pré-visualização embutida disponível para PDF. Para este formato, use Descarregar.</p>
            <Button asChild variant="secondary">
              <a href={downloadUrl}>Descarregar ficheiro</a>
            </Button>
          </div>
        )}

        {doc.extractedText ? (
          <details className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/40 p-4">
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--text-primary)]">
              Texto extraído (resumo)
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--text-secondary)]">
              {doc.extractedText.slice(0, 8000)}
              {doc.extractedText.length > 8000 ? "…" : ""}
            </pre>
          </details>
        ) : null}
      </div>
    </>
  );
}
