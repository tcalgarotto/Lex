import { DocumentLibraryShelf, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Slug fixo do workspace “catálogo Lex” visível para todos os tenants. */
export const PLATFORM_LIBRARY_WORKSPACE_SLUG = "lex-platform-catalog";

export const PLATFORM_SHARED_SHELVES: DocumentLibraryShelf[] = [
  DocumentLibraryShelf.SHARED_LEGAL,
  DocumentLibraryShelf.SHARED_BOOKS,
];

let cachedPlatformWorkspaceId: string | null | undefined;

function envPlatformWorkspaceHint(): string | undefined {
  return process.env["LEX_PLATFORM_LIBRARY_WORKSPACE_ID"]?.trim();
}

/**
 * ID do workspace usado só para PDFs/catálogo enviados por operação (scripts),
 * partilhado por toda a plataforma na Biblioteca (prateleiras SHARED_*).
 * `null` se ainda não existir workspace com slug `lex-platform-catalog` nem env correspondente.
 */
export async function getPlatformLibraryWorkspaceId(): Promise<string | null> {
  if (cachedPlatformWorkspaceId !== undefined) return cachedPlatformWorkspaceId;

  const hint = envPlatformWorkspaceHint();
  if (hint) {
    const w = await prisma.workspace.findFirst({
      where: { OR: [{ id: hint }, { slug: hint }] },
      select: { id: true, slug: true },
    });
    // Só aceitar hint se for mesmo o catálogo (slug fixo). Evita ID de outra base / workspace errado no .env.
    if (w?.slug === PLATFORM_LIBRARY_WORKSPACE_SLUG) {
      cachedPlatformWorkspaceId = w.id;
      return w.id;
    }
    // Hint obsoleto ou aponta para outro workspace: cair para o slug.
  }

  const bySlug = await prisma.workspace.findFirst({
    where: { slug: PLATFORM_LIBRARY_WORKSPACE_SLUG },
    select: { id: true },
  });
  cachedPlatformWorkspaceId = bySlug?.id ?? null;
  return cachedPlatformWorkspaceId;
}

/** Testes: invalidar cache entre execuções. */
export function clearPlatformLibraryWorkspaceIdCache(): void {
  cachedPlatformWorkspaceId = undefined;
}

export function isPlatformSharedShelf(shelf: DocumentLibraryShelf): boolean {
  return shelf === DocumentLibraryShelf.SHARED_LEGAL || shelf === DocumentLibraryShelf.SHARED_BOOKS;
}

/**
 * Cláusula `OR` para ler um documento do workspace ativo **ou** do catálogo global (SHARED_*).
 */
export async function documentReadScopeOr(
  sessionWorkspaceId: string,
): Promise<Prisma.DocumentWhereInput[]> {
  const platformId = await getPlatformLibraryWorkspaceId();
  const parts: Prisma.DocumentWhereInput[] = [{ workspaceId: sessionWorkspaceId }];
  if (platformId && platformId !== sessionWorkspaceId) {
    parts.push({
      workspaceId: platformId,
      libraryShelf: { in: [...PLATFORM_SHARED_SHELVES] },
    });
  }
  return parts;
}

/**
 * `workspaceId` para listagens de prateleiras SHARED_* (merge catálogo global + catálogo do tenant).
 */
export async function workspaceIdsForSharedCatalog(sessionWorkspaceId: string): Promise<string[]> {
  const platformId = await getPlatformLibraryWorkspaceId();
  if (platformId && platformId !== sessionWorkspaceId) {
    return [sessionWorkspaceId, platformId];
  }
  return [sessionWorkspaceId];
}

export async function isPlatformCatalogDocumentWorkspace(workspaceId: string): Promise<boolean> {
  const platformId = await getPlatformLibraryWorkspaceId();
  if (platformId && workspaceId === platformId) return true;
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  return ws?.slug === PLATFORM_LIBRARY_WORKSPACE_SLUG;
}
