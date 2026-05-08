import { redirect } from "next/navigation";

/**
 * Rota legada `/biblioteca`.
 *
 * Antes listava `LegalNorm` (catálogo de leis). Agora isso vive dentro de
 * `/pesquisa-juridica`. Mantemos o caminho histórico apenas como redirect
 * para preservar bookmarks e links externos.
 */
export default function BibliotecaRedirect(): never {
  redirect("/pesquisa-juridica?scope=legislacao");
}
