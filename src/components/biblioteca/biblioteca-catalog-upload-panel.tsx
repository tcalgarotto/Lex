"use client";

import { DocumentUploadButton } from "@/components/documents/document-upload-button";

export function BibliotecaCatalogUploadPanel({ canPublish }: { canPublish: boolean }) {
  if (!canPublish) {
    return (
      <p className="max-w-xl text-xs text-muted-foreground">
        Só perfis com permissão podem acrescentar ficheiros ao catálogo partilhado da Biblioteca.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <DocumentUploadButton
        libraryShelf="SHARED_LEGAL"
        label="Adicionar ao catálogo — Leis e normas"
        variant="outline"
        size="sm"
      />
      <DocumentUploadButton
        libraryShelf="SHARED_BOOKS"
        label="Adicionar ao catálogo — Livros em destaque"
        variant="secondary"
        size="sm"
      />
    </div>
  );
}
