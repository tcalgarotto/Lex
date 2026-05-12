import type { Prisma } from "@prisma/client";
import { DocumentLibraryShelf } from "@prisma/client";

/**
 * Lista “Documentos” do workspace: só `OFFICE_PRIVATE`, excluindo ficheiros soltos
 * enviados por outro utilizador (mantém caso/processo e legado sem remetente).
 */
export function officePrivateDocumentsAndParts(userId: string): Prisma.DocumentWhereInput[] {
  return [
    { libraryShelf: DocumentLibraryShelf.OFFICE_PRIVATE },
    {
      NOT: {
        AND: [
          { caseId: null },
          { processId: null },
          { uploadedByUserId: { not: null } },
          { NOT: { uploadedByUserId: userId } },
        ],
      },
    },
  ];
}
