/**
 * Extrai mensagem amigável de corpos JSON de erro de upload (`/api/documents/upload`, etc.).
 */
export function parseUploadErrorResponseText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return trimmed || "Falha no upload";
  try {
    const j = JSON.parse(trimmed) as { message?: string; error?: string };
    return j.message ?? j.error ?? trimmed;
  } catch {
    return trimmed;
  }
}
