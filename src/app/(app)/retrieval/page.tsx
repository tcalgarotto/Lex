import { redirect } from "next/navigation";

/**
 * Rota legada `/retrieval` redireciona para `/pesquisa-juridica`.
 */
export default function RetrievalRedirect() {
 redirect("/pesquisa-juridica");
}
