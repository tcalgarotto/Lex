import { notFound } from "next/navigation";
import { requireAuthUser, requirePermission } from "@/lib/auth/session";

/**
 * Acesso ao painel de leads beta (dados globais da plataforma).
 * 1) E-mail na allowlist `LEX_BETA_LEADS_ADMIN_EMAILS`, ou
 * 2) OWNER do workspace ativo (mesmo gate de observabilidade interna).
 */
export async function requireBetaLeadsAdmin() {
  const user = await requireAuthUser();
  const email = user.email?.trim().toLowerCase();
  const allowlist = (process.env["LEX_BETA_LEADS_ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (email && allowlist.length > 0 && allowlist.includes(email)) {
    return user;
  }

  try {
    await requirePermission("observabilityView");
    return user;
  } catch {
    notFound();
  }
}
