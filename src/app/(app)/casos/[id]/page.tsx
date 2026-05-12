import { redirect } from "next/navigation";

/** Alias PT-BR → rota canônica em inglês. */
export default async function CasosCaseRedirect({
 params,
}: {
 params: Promise<{ id: string }>;
}) {
 const { id } = await params;
 redirect(`/cases/${id}`);
}
