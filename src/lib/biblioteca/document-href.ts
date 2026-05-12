function isPdf(mimeType: string, fileName: string): boolean {
  const mt = mimeType.toLowerCase();
  return mt.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
}

/** Destino ao abrir um documento a partir da Biblioteca. */
export function workspaceDocumentHref(d: {
  id: string;
  processId: string | null;
  caseId: string | null;
  mimeType?: string;
  originalName?: string;
}): string {
  if (d.processId) {
    return `/processos/${d.processId}/documentos/${d.id}`;
  }
  if (d.caseId) {
    return `/cases/${d.caseId}/documentos`;
  }
  /** PDF solto: ficheiro `inline` — o navegador abre o leitor nativo (rápido). */
  if (isPdf(d.mimeType ?? "", d.originalName ?? "")) {
    return `/api/documents/${d.id}/file`;
  }
  return `/biblioteca/documentos/${d.id}`;
}
