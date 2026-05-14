import Link from "next/link";
import { DocumentLibraryShelf, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { devLogLexTiming } from "@/lib/dev/server-timing";
import { prisma } from "@/lib/prisma";
import { officePrivateDocumentsAndParts } from "@/lib/documents/office-list-filter";
import { workspaceDocumentHref } from "@/lib/biblioteca/document-href";
import {
  workspaceIdsForSharedCatalog,
  getPlatformLibraryWorkspaceId,
} from "@/lib/biblioteca/platform-library";
import {
  BibliotecaShelfCarousel,
  BibliotecaShelfSection,
} from "@/components/biblioteca/biblioteca-shelf-section";
import { BibliotecaOfficeDocumentCard } from "@/components/biblioteca/biblioteca-office-document-card";

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
const shelfLegal = {
  libraryShelf: DocumentLibraryShelf.SHARED_LEGAL,
} satisfies Prisma.DocumentWhereInput;
const shelfBooks = {
  libraryShelf: DocumentLibraryShelf.SHARED_BOOKS,
} satisfies Prisma.DocumentWhereInput;

/** Máximo de capas por prateleira na home (mesmo padrão nas 3 fileiras). */
const BIBLIOTECA_HOME_SHELF_PREVIEW = 8;

export default async function BibliotecaPage() {
  const pageT0 = performance.now();
  const tWs = performance.now();
  const { workspaceId, user } = await getWorkspaceContext();
  devLogLexTiming("biblioteca.getWorkspaceContext", performance.now() - tWs);
  const tCat = performance.now();
  const [catalogWorkspaceIds, platformCatalogId] = await Promise.all([
    workspaceIdsForSharedCatalog(workspaceId),
    getPlatformLibraryWorkspaceId(),
  ]);
  devLogLexTiming("biblioteca.catalogLookups", performance.now() - tCat);

  /** Mesmo critério que a lista em `/documentos` (sem filtros de URL). */
  const privateOfficeAnd = [...officePrivateDocumentsAndParts(user.id)];

  const whereLeisCatalogo = {
    workspaceId: { in: catalogWorkspaceIds },
    deletedAt: null,
    archivedAt: null,
    ...shelfLegal,
  } satisfies Prisma.DocumentWhereInput;

  const whereLivrosCatalogo = {
    workspaceId: { in: catalogWorkspaceIds },
    deletedAt: null,
    archivedAt: null,
    ...shelfBooks,
  } satisfies Prisma.DocumentWhereInput;

  const whereEquipe = {
    workspaceId,
    deletedAt: null,
    archivedAt: null,
    AND: privateOfficeAnd,
  } satisfies Prisma.DocumentWhereInput;

  const tDb = performance.now();
  const [
    sharedLegalPreview,
    leisCatalogoCount,
    sharedBooksPreview,
    livrosCatalogoCount,
    privateOfficePreview,
    equipeDocumentCount,
  ] = await Promise.all([
    prisma.document.findMany({
      where: whereLeisCatalogo,
      orderBy: { createdAt: "desc" },
      take: BIBLIOTECA_HOME_SHELF_PREVIEW,
      select: docSelect,
    }),
    prisma.document.count({ where: whereLeisCatalogo }),
    prisma.document.findMany({
      where: whereLivrosCatalogo,
      orderBy: { createdAt: "desc" },
      take: BIBLIOTECA_HOME_SHELF_PREVIEW,
      select: docSelect,
    }),
    prisma.document.count({ where: whereLivrosCatalogo }),
    prisma.document.findMany({
      where: whereEquipe,
      orderBy: { updatedAt: "desc" },
      take: BIBLIOTECA_HOME_SHELF_PREVIEW,
      select: docSelect,
    }),
    prisma.document.count({ where: whereEquipe }),
  ]);

  devLogLexTiming("biblioteca.prisma", performance.now() - tDb);
  devLogLexTiming("biblioteca.page", performance.now() - pageT0);

  return (
    <div className="flex flex-col gap-10">
      <BibliotecaShelfSection
        id="shelf-leis-codigos-normas"
        title="Leis, códigos e normas"
        subtitle="Catálogo Lex na plataforma (público para todos os utilizadores)."
        verMaisHref={leisCatalogoCount > 0 ? "/biblioteca/leis" : null}
        verMaisLabel={
          leisCatalogoCount > BIBLIOTECA_HOME_SHELF_PREVIEW
            ? `Ver mais (${leisCatalogoCount})`
            : "Ver todos"
        }
      >
        {leisCatalogoCount === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-8 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
            Ainda não há entradas nesta prateleira. O catálogo global é preenchido pela
            operação Lex (scripts de upload para o workspace de plataforma), não pelo
            envio em Documentos.
            {!platformCatalogId ? (
              <span className="mt-3 block text-xs text-[color:var(--text-secondary)]/90">
                Neste ambiente ainda não existe o workspace «lex-platform-catalog».
                Aplique as migrations em produção e volte a correr o script de upload com
                a URL da base de produção.
              </span>
            ) : null}
          </p>
        ) : (
          <BibliotecaShelfCarousel>
            {sharedLegalPreview.map((d) => (
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
        verMaisHref={livrosCatalogoCount > 0 ? "/biblioteca/livros" : null}
        verMaisLabel={
          livrosCatalogoCount > BIBLIOTECA_HOME_SHELF_PREVIEW
            ? `Ver mais (${livrosCatalogoCount})`
            : "Ver todos"
        }
      >
        {livrosCatalogoCount === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-4 py-8 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
            Ainda não há obras nesta prateleira. Use o script de upload com{" "}
            <code className="rounded bg-black/20 px-1 py-0.5 text-[11px]">
              --shelf=SHARED_BOOKS
            </code>{" "}
            no workspace de catálogo global (mesmo fluxo que leis e normas).
          </p>
        ) : (
          <BibliotecaShelfCarousel>
            {sharedBooksPreview.map((d) => (
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
        verMaisHref={equipeDocumentCount > 0 ? "/documentos" : null}
        verMaisLabel={
          equipeDocumentCount > BIBLIOTECA_HOME_SHELF_PREVIEW
            ? `Ver mais (${equipeDocumentCount})`
            : "Ver todos"
        }
      >
        {equipeDocumentCount === 0 ? (
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
            {privateOfficePreview.map((d) => (
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
                showCaseRow={false}
              />
            ))}
          </BibliotecaShelfCarousel>
        )}
      </BibliotecaShelfSection>
    </div>
  );
}
