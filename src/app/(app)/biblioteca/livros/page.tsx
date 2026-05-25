import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { DocumentLibraryShelf, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { workspaceDocumentHref } from "@/lib/biblioteca/document-href";
import { workspaceIdsForSharedCatalog } from "@/lib/biblioteca/platform-library";
import { BibliotecaDocumentsGrid } from "@/components/biblioteca/biblioteca-shelf-section";
import { BibliotecaOfficeDocumentCard } from "@/components/biblioteca/biblioteca-office-document-card";

export const metadata: Metadata = {
  title: "Livros em destaque",
  description: "Catálogo público de leituras na plataforma JustOS.",
};

const shelfBooks = { libraryShelf: DocumentLibraryShelf.SHARED_BOOKS } satisfies Prisma.DocumentWhereInput;

const docSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
  processId: true,
  caseId: true,
  case: { select: { id: true, title: true } },
} as const;

const LISTA_MAX = 200;

export default async function BibliotecaLivrosPage() {
  const { workspaceId } = await getWorkspaceContext();
  const catalogWorkspaceIds = await workspaceIdsForSharedCatalog(workspaceId);

  const whereLivros = {
    workspaceId: { in: catalogWorkspaceIds },
    deletedAt: null,
    archivedAt: null,
    ...shelfBooks,
  } satisfies Prisma.DocumentWhereInput;

  const livros = await prisma.document.findMany({
    where: whereLivros,
    orderBy: { createdAt: "desc" },
    take: LISTA_MAX,
    select: docSelect,
  });

  return (
    <div className="w-full min-w-0 space-y-8">
      <Link
        href="/biblioteca"
        className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--text-secondary)] lex-transition hover:text-[color:var(--text-primary)]"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar à Biblioteca
      </Link>

      {livros.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-10 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
          Ainda não há obras nesta prateleira.
        </p>
      ) : (
        <BibliotecaDocumentsGrid>
          {livros.map((d, i) => (
            <BibliotecaOfficeDocumentCard
              key={d.id}
              href={workspaceDocumentHref(d)}
              documentId={d.id}
              title={d.originalName}
              mimeType={d.mimeType}
              caseTitle={null}
              publishedAt={d.createdAt}
              thumbnailVersion={d.updatedAt.getTime()}
              topBadge="Catálogo: livros"
              showCaseRow={false}
              lqipLoading={i < 12 ? "eager" : "lazy"}
            />
          ))}
        </BibliotecaDocumentsGrid>
      )}
    </div>
  );
}
