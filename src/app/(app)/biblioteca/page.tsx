import Link from "next/link";
import { DocumentLibraryShelf, Prisma } from "@prisma/client";
import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officePrivateDocumentsAndParts } from "@/lib/documents/office-list-filter";
import { workspaceDocumentHref } from "@/lib/biblioteca/document-href";
import { workspaceIdsForSharedCatalog, getPlatformLibraryWorkspaceId } from "@/lib/biblioteca/platform-library";
import { BibliotecaShelfCarousel, BibliotecaShelfSection } from "@/components/biblioteca/biblioteca-shelf-section";
import { BibliotecaOfficeDocumentCard } from "@/components/biblioteca/biblioteca-office-document-card";

export const dynamic = "force-dynamic";

const docSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  createdAt: true,
  processId: true,
  caseId: true,
  case: { select: { id: true, title: true } },
} as const;

/** Filtros reutilizáveis (evita duplicar literais e ajuda o inferidor do Prisma). */
const shelfLegal = { libraryShelf: DocumentLibraryShelf.SHARED_LEGAL } satisfies Prisma.DocumentWhereInput;
const shelfBooks = { libraryShelf: DocumentLibraryShelf.SHARED_BOOKS } satisfies Prisma.DocumentWhereInput;

export default async function BibliotecaPage() {
  const { workspaceId, user } = await getWorkspaceContext();
  const [catalogWorkspaceIds, platformCatalogId] = await Promise.all([
    workspaceIdsForSharedCatalog(workspaceId),
    getPlatformLibraryWorkspaceId(),
  ]);

  /** Mesmo critério que a lista em `/documentos` (sem filtros de URL). */
  const privateOfficeAnd = [...officePrivateDocumentsAndParts(user.id)];

  const [sharedLegal, sharedBooks, privateOffice] = await Promise.all([
    prisma.document.findMany({
      where: {
        workspaceId: { in: catalogWorkspaceIds },
        deletedAt: null,
        archivedAt: null,
        ...shelfLegal,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: docSelect,
    }),
    prisma.document.findMany({
      where: {
        workspaceId: { in: catalogWorkspaceIds },
        deletedAt: null,
        archivedAt: null,
        ...shelfBooks,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: docSelect,
    }),
    prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        archivedAt: null,
        AND: privateOfficeAnd,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: docSelect,
    }),
  ]);

  return (
    <AppShell title="Biblioteca" fullWidthContent>
      {/**
       * Não duplicar `lex-glass-mesh` aqui: o AppShell já pinta os orbes no viewport.
       * `fullWidthContent`: main sem capa nem padding — esta página usa toda a largura útil à direita da sidebar.
       */}
      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-8 px-6 py-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[2rem]">
                Biblioteca
              </h1>
              <p className="max-w-4xl text-base leading-relaxed text-[color:var(--text-secondary)] lg:max-w-5xl">
                Catálogo Lex (global na plataforma) com{" "}
                <strong className="font-semibold text-[color:var(--text-primary)]">
                  leis, códigos e normas
                </strong>
                {" "}e{" "}
                <strong className="font-semibold text-[color:var(--text-primary)]">
                  leituras em destaque
                </strong>
                ; à parte, os{" "}
                <strong className="font-semibold text-[color:var(--text-primary)]">
                  documentos que a sua equipe envia em Documentos
                </strong>{" "}
                ficam na linha «Documentos da equipe». Pré-visualização em PDF quando o ficheiro for compatível.
              </p>
            </div>
          </header>

          <BibliotecaShelfSection
            id="shelf-leis-codigos-normas"
            title="Leis, códigos e normas"
            subtitle="Catálogo Lex na plataforma (público para todos os utilizadores)."
            verMaisHref="/pesquisa-juridica"
            verMaisLabel="Pesquisa jurídica"
          >
            {sharedLegal.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-8 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
                Ainda não há entradas nesta prateleira. O catálogo global é preenchido pela operação Lex
                (scripts de upload para o workspace de plataforma), não pelo envio em Documentos.
                {!platformCatalogId ? (
                  <span className="mt-3 block text-xs text-[color:var(--text-secondary)]/90">
                    Neste ambiente ainda não existe o workspace «lex-platform-catalog». Aplique as migrations
                    em produção e volte a correr o script de upload com a URL da base de produção.
                  </span>
                ) : null}
              </p>
            ) : (
              <BibliotecaShelfCarousel>
                {sharedLegal.map((d) => (
                  <BibliotecaOfficeDocumentCard
                    key={d.id}
                    href={workspaceDocumentHref(d)}
                    documentId={d.id}
                    title={d.originalName}
                    mimeType={d.mimeType}
                    caseTitle={null}
                    publishedAt={d.createdAt}
                    topBadge="Catálogo: leis e normas"
                    showCaseRow={false}
                  />
                ))}
              </BibliotecaShelfCarousel>
            )}
          </BibliotecaShelfSection>

          <BibliotecaShelfSection
            id="shelf-livros-recomendados"
            title="Livros em destaque"
            subtitle="Catálogo Lex na plataforma (público para todos os utilizadores)."
            verMaisHref="/pesquisa-juridica"
            verMaisLabel="Pesquisa jurídica"
          >
            {sharedBooks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-8 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
                Ainda não há obras nesta prateleira. Use o script de upload com{" "}
                <code className="rounded bg-black/20 px-1 py-0.5 text-[11px]">--shelf=SHARED_BOOKS</code> no
                workspace de catálogo global (mesmo fluxo que leis e normas).
              </p>
            ) : (
              <BibliotecaShelfCarousel>
                {sharedBooks.map((d) => (
                  <BibliotecaOfficeDocumentCard
                    key={d.id}
                    href={workspaceDocumentHref(d)}
                    documentId={d.id}
                    title={d.originalName}
                    mimeType={d.mimeType}
                    caseTitle={null}
                    publishedAt={d.createdAt}
                    topBadge="Catálogo: livros"
                    showCaseRow={false}
                  />
                ))}
              </BibliotecaShelfCarousel>
            )}
          </BibliotecaShelfSection>

          <BibliotecaShelfSection
            id="shelf-documentos-equipe"
            title="Documentos da equipe"
            subtitle="Documentos privados e disponíveis apenas para a sua equipe."
            verMaisHref="/documentos"
            verMaisLabel="Ir a Documentos"
          >
            {privateOffice.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-8 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
                Não há documentos a mostrar. Carregue ficheiros em{" "}
                <Link
                  href="/documentos"
                  className="font-medium text-[color:var(--text-primary)] underline-offset-2 hover:underline"
                >
                  Documentos
                </Link>
                .
              </p>
            ) : (
              <BibliotecaShelfCarousel>
                {privateOffice.map((d) => (
                  <BibliotecaOfficeDocumentCard
                    key={d.id}
                    href={workspaceDocumentHref(d)}
                    documentId={d.id}
                    title={d.originalName}
                    mimeType={d.mimeType}
                    caseTitle={d.case?.title ?? null}
                    publishedAt={d.createdAt}
                    topBadge="Privado"
                    showCaseRow
                  />
                ))}
              </BibliotecaShelfCarousel>
            )}
          </BibliotecaShelfSection>
      </div>
    </AppShell>
  );
}
