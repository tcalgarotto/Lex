import { getLogger } from "@/lib/logger";
import { getPublicAppUrl } from "@/lib/marketing/app-url";
import type { BetaLeadRequest } from "@prisma/client";

const log = getLogger("lex.marketing.beta-lead-notify");

export type BetaLeadNotifyPayload = Pick<
  BetaLeadRequest,
  | "id"
  | "name"
  | "email"
  | "company"
  | "role"
  | "teamSize"
  | "mainPain"
  | "intent"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
>;

function getNotifyConfig():
  | { apiKey: string; from: string; to: string[] }
  | null {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from =
    process.env["BETA_LEAD_NOTIFY_FROM"]?.trim() ||
    process.env["EMAIL_FROM"]?.trim() ||
    "";
  const toRaw =
    process.env["BETA_LEAD_NOTIFY_TO"]?.trim() ||
    process.env["LEX_BETA_LEADS_NOTIFY_TO"]?.trim() ||
    "";
  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!apiKey || !from || to.length === 0) return null;
  return { apiKey, from, to };
}

function buildHtml(lead: BetaLeadNotifyPayload): string {
  const appUrl = getPublicAppUrl();
  const intentLabel = lead.intent === "demo" ? "Demonstração" : "Beta privado";
  const utm =
    [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ") ||
    "—";
  const pain = lead.mainPain?.trim() ? lead.mainPain.slice(0, 500) : "—";
  return `
    <h2>Novo lead — JustOS</h2>
    <p><strong>Intenção:</strong> ${intentLabel}</p>
    <p><strong>Nome:</strong> ${escapeHtml(lead.name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(lead.email)}</p>
    <p><strong>Escritório:</strong> ${escapeHtml(lead.company)}</p>
    <p><strong>Cargo:</strong> ${escapeHtml(lead.role ?? "—")}</p>
    <p><strong>Time:</strong> ${escapeHtml(lead.teamSize)}</p>
    <p><strong>Principal dor:</strong> ${escapeHtml(pain)}</p>
    <p><strong>UTM:</strong> ${escapeHtml(utm)}</p>
    <p><a href="${appUrl}/settings/admin/beta-leads">Abrir painel de leads</a></p>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notifica equipe via Resend. Não propaga erro ao chamador (falha silenciosa + log).
 */
export async function notifyTeamOfBetaLead(lead: BetaLeadNotifyPayload): Promise<void> {
  const cfg = getNotifyConfig();
  if (!cfg) {
    log.info("beta lead notify skipped (RESEND_API_KEY / FROM / TO não configurados)");
    return;
  }

  const subject =
    lead.intent === "demo"
      ? `[JustOS] Demonstração — ${lead.company}`
      : `[JustOS] Beta — ${lead.company}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: cfg.to,
        subject,
        html: buildHtml(lead),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.warn("beta lead notify failed", { status: res.status, leadId: lead.id, body: body.slice(0, 200) });
    }
  } catch (e) {
    log.warn("beta lead notify error", { leadId: lead.id, err: String(e) });
  }
}
