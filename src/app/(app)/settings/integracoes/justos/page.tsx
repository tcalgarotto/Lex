import Link from "next/link";
import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  JUSTOS_PRODUCT_NAME,
  JUSTOS_PRO_NAME,
  JUSTOS_SETTINGS_INTRO,
  JUSTOS_TAGLINE,
  isJustosProActive,
  readJustosWorkspaceConfig,
  readLexN8nServiceToken,
} from "@/lib/justos";
import { JustosPlanPicker } from "./justos-plan-picker";
import { JustosSubscriptionStatus } from "./justos-subscription-status";
import { JustosSetupSteps } from "./justos-setup-steps";
import { JustosPhoneForm } from "./justos-phone-form";
import { JustosWorkspaceForm } from "./justos-workspace-form";
import { JustosWhatsappOfficeCard } from "@/components/justos/justos-whatsapp-office-card";
import { finalizeExpiredJustosProIfNeeded } from "@/lib/justos/pro-cancel";

export const dynamic = "force-dynamic";

export default async function JustosIntegracaoPage() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  const isOwner = can(role, "billingManage");
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      onboardingJson: true,
      memberships: {
        where: { role: MembershipRole.OWNER },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });
  const owner = ws?.memberships[0]?.user;
  const sandboxCpf =
    process.env["ASAAS_SANDBOX_DEFAULT_CPF"]?.trim() || "24971563792";
  const asaasSandbox =
    (process.env["ASAAS_API_BASE_URL"] ?? "https://api-sandbox.asaas.com").includes("sandbox");
  const onboardingJson = await finalizeExpiredJustosProIfNeeded(
    workspaceId,
    ws?.onboardingJson,
  );
  const config = readJustosWorkspaceConfig(onboardingJson);
  const ownerPhone = config.officePhone ?? "";
  const proActive = isJustosProActive(config);
  const pendingPayment =
    Boolean(config.asaasSubscriptionId) &&
    !config.proEnabled &&
    config.proSubscriptionStatus === "inactive";
  const phoneConfigured = Boolean(config.lawyerWhatsApp?.length);
  const webhookConfigured = Boolean(process.env["LEX_N8N_WEBHOOK_URL"]?.trim());
  const serviceTokenConfigured = Boolean(readLexN8nServiceToken());
  const operational = config.enabled && webhookConfigured && serviceTokenConfigured;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sistema operacional
          </p>
          <h1 className="text-xl font-semibold">{JUSTOS_PRODUCT_NAME}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{JUSTOS_TAGLINE}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/integracoes">← Integrações</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <JustosPlanPicker
            isOwner={isOwner}
            proActive={proActive}
            initialCycle={config.proBillingCycle}
            initialPaymentId={config.asaasPaymentId}
            pendingPayment={pendingPayment}
            ownerEmail={owner?.email ?? ""}
            ownerName={owner?.name ?? ""}
            sandboxCpf={sandboxCpf}
            ownerPhone={ownerPhone}
            isSandbox={asaasSandbox}
          />

          {proActive || pendingPayment ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assinatura</CardTitle>
              </CardHeader>
              <CardContent>
                <JustosSubscriptionStatus
                  isOwner={isOwner}
                  proActive={proActive}
                  billingCycle={config.proBillingCycle}
                  subscribedAt={config.proSubscribedAt}
                  renewsAt={config.proRenewsAt}
                  status={config.proSubscriptionStatus}
                  cancelAtPeriodEnd={config.proCancelAtPeriodEnd}
                  accessUntil={config.proAccessUntil ?? config.proRenewsAt}
                  paymentId={config.asaasPaymentId}
                  pendingPayment={pendingPayment}
                  ownerEmail={owner?.email ?? ""}
                  ownerName={owner?.name ?? ""}
                  sandboxCpf={sandboxCpf}
                  ownerPhone={ownerPhone}
                  isSandbox={asaasSandbox}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card className={proActive ? "" : "opacity-60"}>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp do escritório</CardTitle>
              <CardDescription>
                Sessão OpenClaw dedicada a este workspace (JustOS Command).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JustosWhatsappOfficeCard proActive={proActive} />
            </CardContent>
          </Card>

          <Card className={proActive ? "" : "opacity-60"}>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp autorizado</CardTitle>
              <CardDescription>
                Número do advogado que recebe alertas operacionais deste escritório.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JustosPhoneForm
                initialLawyerWhatsApp={config.lawyerWhatsApp?.[0] ?? ""}
                initialOfficePhone={config.officePhone ?? ""}
                proActive={proActive}
                disabled={!proActive}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operação técnica</CardTitle>
              <CardDescription>{JUSTOS_SETTINGS_INTRO}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={config.enabled ? "default" : "outline"}>
                  JustOS {config.enabled ? "ativado" : "desligado"}
                </Badge>
                <Badge variant={proActive ? "default" : "secondary"}>
                  {JUSTOS_PRO_NAME} {proActive ? "ativo" : "não contratado"}
                </Badge>
                <Badge variant={webhookConfigured ? "outline" : "secondary"}>
                  n8n {webhookConfigured ? "OK" : "pendente"}
                </Badge>
              </div>
              <JustosWorkspaceForm
                initialEnabled={config.enabled}
                initialProEnabled={config.proEnabled}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <JustosSetupSteps
              subscribed={proActive}
              phoneConfigured={phoneConfigured}
              operational={operational && phoneConfigured}
            />
            {role && role !== MembershipRole.OWNER ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Você está como {role.toLowerCase()}. Assinatura e cancelamento exigem titular
                (owner).
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
