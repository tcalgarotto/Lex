import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestIp, rateLimit, rateLimitHeaders, rateLimitHttpStatus } from "@/lib/rate-limit";
import { betaLeadBodySchema, hashLeadIp } from "@/lib/marketing/beta-lead";
import { normalizeAttributionForDb } from "@/lib/marketing/beta-lead-attribution";
import { notifyTeamOfBetaLead } from "@/lib/marketing/beta-lead-notify";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.marketing.beta-lead");

export async function POST(req: Request) {
  const ip = getRequestIp(req.headers);
  const rl = await rateLimit({
    key: `beta-lead:ip:${ip}`,
    limit: 8,
    windowSeconds: 3600,
    tier: "default",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em alguns minutos." },
      { status: rateLimitHttpStatus(rl), headers: rateLimitHeaders(rl) },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = betaLeadBodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(first).flat()[0] ?? "Verifique os campos e tente novamente.";
    return NextResponse.json({ error: message, fields: first }, { status: 400 });
  }

  const body = parsed.data;

  if (body.companyWebsite?.trim()) {
    return NextResponse.json({ ok: true }, { status: 201, headers: rateLimitHeaders(rl) });
  }

  const emailRl = await rateLimit({
    key: `beta-lead:email:${body.email.toLowerCase()}`,
    limit: 3,
    windowSeconds: 86400,
    tier: "default",
  });
  if (!emailRl.allowed) {
    return NextResponse.json(
      { error: "Já recebemos sua solicitação recentemente. Nossa equipe entrará em contato." },
      { status: 429, headers: rateLimitHeaders(emailRl) },
    );
  }

  const attribution = normalizeAttributionForDb(body);

  let leadId: string;
  try {
    const lead = await prisma.betaLeadRequest.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        company: body.company,
        role: body.role?.trim() || null,
        teamSize: body.teamSize,
        mainPain: body.mainPain?.trim() || null,
        intent: body.intent,
        contactConsent: true,
        source: "landing",
        ...attribution,
        ipHash: ip === "unknown" ? null : hashLeadIp(ip),
      },
    });
    leadId = lead.id;
  } catch (e) {
    log.error("beta lead persist failed", { err: String(e) });
    return NextResponse.json(
      { error: "Não foi possível registrar sua solicitação. Tente novamente em instantes." },
      { status: 500 },
    );
  }

  void notifyTeamOfBetaLead({
    id: leadId,
    name: body.name,
    email: body.email,
    company: body.company,
    role: body.role?.trim() || null,
    teamSize: body.teamSize,
    mainPain: body.mainPain?.trim() || null,
    intent: body.intent,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
  }).catch(() => undefined);

  log.info("beta lead created", { leadId, intent: body.intent });

  return NextResponse.json(
    {
      ok: true,
      message:
        body.intent === "demo"
          ? "Pedido de demonstração recebido. Entraremos em contato em breve."
          : "Solicitação de beta recebida. Entraremos em contato em breve.",
    },
    { status: 201, headers: rateLimitHeaders(rl) },
  );
}
