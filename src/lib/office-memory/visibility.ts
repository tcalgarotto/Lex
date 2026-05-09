import type { Prisma } from "@prisma/client";

/**
 * F19 — Quem pode ver entradas de `OfficeMemory` no workspace atual.
 * USER: só o dono. WORKSPACE/CASE: compartilhado; `private` restringe ao criador.
 */
export function officeMemoryReadableWhere(userId: string): Prisma.OfficeMemoryWhereInput {
  return {
    OR: [
      { scope: "USER", ownerUserId: userId },
      { scope: "WORKSPACE", private: false },
      { scope: "WORKSPACE", private: true, createdById: userId },
      { scope: "CASE", private: false },
      { scope: "CASE", private: true, createdById: userId },
    ],
  };
}
