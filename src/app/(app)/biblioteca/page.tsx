import Link from "next/link";
import { DocumentLibraryShelf, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officePrivateDocumentsAndParts } from "@/lib/documents/office-list-filter";
import { workspaceDocumentHref } from "@/lib/biblioteca/document-href";
import { workspaceIdsForSharedCatalog, getPlatformLibraryWorkspaceId } from "@/lib/biblioteca/platform-library";
import { BibliotecaShelfCarousel, BibliotecaShelfSection } from "@/components/biblioteca/biblioteca-shelf-section";
import { BibliotecaOfficeDocumentCard } from "@/components/biblioteca/biblioteca-office-document-card";
import { lexPageLeadClassName, lexPageTitleClassName } from "@/lib/lex-ds";

export const dynamic = "force-dynamic";

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
    <>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <h1 className={lexPageTitleClassName}>Biblioteca</h1>
            <p className={lexPageLeadClassName}>
              Catálogo Lex (global na plataforma) com{" "}
              <strong className="font-semibold text-[color:var(--text-primary)]">
                leis, códigos e normas
              </strong>{" "}
              e{" "}
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
                  thumbnailVersion={d.updatedAt.getTime()}
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
                  thumbnailVersion={d.updatedAt.getTime()}
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
                  thumbnailVersion={d.updatedAt.getTime()}
                  topBadge="Privado"
                  showCaseRow
                />
              ))}
            </BibliotecaShelfCarousel>
          )}
        </BibliotecaShelfSection>
    </>
  );
}
