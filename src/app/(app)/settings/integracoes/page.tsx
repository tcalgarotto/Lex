import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatJustosPriceBrl,
  isJustosProActive,
  JUSTOS_PRODUCT_NAME,
  JUSTOS_PRO_NAME,
  JUSTOS_PRO_PRICE_MONTHLY_BRL,
  JUSTOS_PRO_TAGLINE,
  readJustosWorkspaceConfig,
} from "@/lib/justos";
import { getCourtConnectorDefinitions } from "@/lib/court-connectors/registry";

function statusLabel(status: string) {
  if (status === "active") return "Ativo";
  if (status === "manual_bridge") return "Abertura assistida";
  if (status === "public_read_only") return "Público/leitura";
  if (status === "requires_official_authorization") return "Oficial-only";
  if (status === "requires_user_login") return "Requer login";
  if (status === "requires_certificate") return "Requer certificado";
  if (status === "available") return "Disponível";
  if (status === "blocked") return "Bloqueado";
  if (status === "disabled") return "Desativado";
  return "Preparado";
}

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const { workspaceId } = await getWorkspaceContext();
  const [connections, ws] = await Promise.all([
    prisma.courtConnection.findMany({
      where: { workspaceId },
      select: { provider: true, status: true, lastConnectedAt: true, revokedAt: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingJson: true },
    }),
  ]);
  const justos = readJustosWorkspaceConfig(ws?.onboardingJson);
  const justosPro = isJustosProActive(justos);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            JustOS (operacional) e conectores judiciais oficiais.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="default">
            <Link href="/settings/integracoes/justos">JustOS</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/integracoes/acesso-oficial">Acesso oficial</Link>
          </Button>
        </div>
      </div>

      <Card className="ring-1 ring-[color:var(--brand-border)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{JUSTOS_PRODUCT_NAME}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{JUSTOS_PRO_TAGLINE}</p>
            <p className="mt-2 text-sm">
              {JUSTOS_PRO_NAME} a partir de{" "}
              <span className="font-semibold">
                {formatJustosPriceBrl(JUSTOS_PRO_PRICE_MONTHLY_BRL)}/mês
              </span>
            </p>
          </div>
          <Badge variant={justosPro ? "default" : "secondary"}>
            {justosPro ? "Pro ativo" : "Módulo adicional"}
          </Badge>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/settings/integracoes/justos">
              {justosPro ? "Gerenciar JustOS" : "Assinar e configurar"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-sm font-medium text-muted-foreground">Judiciais</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {getCourtConnectorDefinitions().map((connector) => {
          const connection = connections.find((item) => item.provider === connector.provider);
          const status = connection?.status ?? connector.status;
          return (
            <Card key={connector.provider}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{connector.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{connector.description}</p>
                </div>
                <Badge variant="outline">{statusLabel(status)}</Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="font-medium text-[color:var(--text-primary)]">Entrega</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {connector.delivers.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-[color:var(--text-primary)]">Limites</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {connector.limitations.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-xs">
                  {connector.requiresLogin || connector.requiresCertificate
                    ? "O JustOS não armazena senha, PIN, certificado, captcha, sessão ou cookie de tribunal."
                    : connector.canRunAutomatically
                      ? "Automação permitida dentro dos limites da fonte oficial configurada no servidor."
                      : "Bridge manual/assistido: registre a fonte oficial e revise antes de qualquer prazo."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {connector.primaryActionUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={connector.primaryActionUrl} target="_blank" rel="noreferrer">
                        {connector.primaryActionLabel}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href="/processos">Vincular a processo</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/publicacoes">Publicações/import manual</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
