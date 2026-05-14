import { DocumentLibraryShelf, MembershipRole, type Document } from "@prisma/client";
import { hasAtLeast } from "@/lib/auth/permissions";

export type DocumentAccessFields = Pick<
  Document,
  "libraryShelf" | "uploadedByUserId" | "caseId" | "processId"
>;

/** Leitura: catálogo partilhado para todo o workspace; privado só remetente em ficheiros soltos (legado sem remetente continua visível no workspace). */
export function userCanReadDocument(viewerUserId: string, doc: DocumentAccessFields): boolean {
  if (
    doc.libraryShelf === DocumentLibraryShelf.SHARED_LEGAL ||
    doc.libraryShelf === DocumentLibraryShelf.SHARED_BOOKS
  ) {
    return true;
  }
  // Se estiver vinculado a caso ou processo, visível para o time (filtrado por workspaceId no DB).
  if (doc.caseId != null || doc.processId != null) {
    return true;
  }
  // Se for standalone, apenas o dono pode ver.
  return doc.uploadedByUserId === viewerUserId;
}

/** Exclusão: catálogo partilhado — advogado+; standalone privado — remetente ou admin; com caso/processo — advogado+. */
export function userCanDeleteDocument(
  viewerUserId: string,
  role: MembershipRole | null,
  doc: DocumentAccessFields,
): boolean {
  if (!role) return false;
  const standalone = doc.caseId == null && doc.processId == null;
  if (
    doc.libraryShelf === DocumentLibraryShelf.SHARED_LEGAL ||
    doc.libraryShelf === DocumentLibraryShelf.SHARED_BOOKS
  ) {
    return hasAtLeast(role, MembershipRole.LAWYER);
  }
  if (standalone) {
    if (!doc.uploadedByUserId) {
      return hasAtLeast(role, MembershipRole.ADMIN);
    }
    return doc.uploadedByUserId === viewerUserId || hasAtLeast(role, MembershipRole.ADMIN);
  }
  return hasAtLeast(role, MembershipRole.LAWYER);
}
