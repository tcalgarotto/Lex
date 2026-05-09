import { redirect } from "next/navigation";

/**
 * Rota legada `/retrieval` redireciona para o nome amigável `/pesquisa-juridica`.
 * `/retrieval/explain` continua funcional como modo admin/debug (acesso direto via URL
 * ou via item "Retrieval (debug)" no menu Avançado).
 */
export default function RetrievalRedirect() {
  redirect("/pesquisa-juridica");
}
