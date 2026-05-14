import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { getOfficialAccessProgramSources, type OfficialAccessStatus } from "@/lib/official-access/program";

export const dynamic = "force-dynamic";

function statusLabel(status: OfficialAccessStatus) {
  const labels: Record<OfficialAccessStatus, string> = {
    active: "Ativo",
    public_api_available: "API pública validada",
    audit: "Em auditoria",
    requires_institutional_credential: "Requer credencial institucional",
    requires_homologation: "Requer homologação",
    tribunal_dependent: "Depende do tribunal",
    assisted_bridge: "Bridge assistido",
    blocked: "Bloqueado",
  };
  return labels[status];
}

function statusTone(status: OfficialAccessStatus) {
  if (status === "active" || status === "public_api_available") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "blocked") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "assisted_bridge" || status === "tribunal_dependent") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

export default async function OfficialAccessProgramPage() {
  await getWorkspaceContextWithRole();
  const sources = getOfficialAccessProgramSources();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Programa de acesso oficial</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Trilho interno para sair de bridges assistidos apenas quando houver API oficial, credencial,
            homologação e autorização compatível. Nenhum token, segredo ou endpoint sensível aparece no cliente.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/integracoes">Voltar às integrações</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guardrails de segurança</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3">
            Não fazer scraping, não burlar captcha, não guardar cookie de sessão e não armazenar senha do advogado.
          </p>
          <p className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3">
            Tokens oficiais futuros serão server-only, criptografados, escopados, revogáveis e auditados.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{source.source}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{source.delivers}</p>
              </div>
              <Badge variant="outline" className={statusTone(source.status)}>
                {statusLabel(source.status)}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-[color:var(--text-primary)]">API pública: </span>
                  {source.publicApi}
                </p>
                <p>
                  <span className="font-medium text-[color:var(--text-primary)]">API autenticada: </span>
                  {source.authenticatedApi}
                </p>
                <p>
                  <span className="font-medium text-[color:var(--text-primary)]">Como obter acesso: </span>
                  {source.accessPath}
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-[color:var(--text-primary)]">Risco: </span>
                  {source.risk}
                </p>
                <p>
                  <span className="font-medium text-[color:var(--text-primary)]">Próximo passo: </span>
                  {source.nextStep}
                </p>
                <div className="flex flex-wrap gap-2">
                  {source.documentationUrls.map((url) => (
                    <Button key={url} asChild size="sm" variant="outline">
                      <Link href={url} target="_blank" rel="noreferrer">
                        Documento oficial
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
