import { CourtConnectorStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const OFFICIAL_CONNECTORS = [
  ["DATAJUD_PUBLIC", "DataJud Público", "Ativo para metadados públicos, capa e movimentações."],
  ["ESCRITORIO_DIGITAL", "Escritório Digital", "Preparado para integração oficial futura."],
  ["MNI", "MNI", "Preparado para token/autorização oficial do tribunal."],
  ["PJE", "PJe", "Somente por caminho oficial, sem scraping."],
  ["ESAJ", "e-SAJ", "Somente por caminho oficial, sem automação de login."],
] as const;

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const { workspaceId } = await getWorkspaceContext();
  const connections = await prisma.courtConnection.findMany({
    where: { workspaceId },
    select: { provider: true, status: true, lastConnectedAt: true, revokedAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrações judiciais</h1>
        <p className="text-sm text-muted-foreground">
          Status operacional sem expor chaves, endpoints técnicos ou credenciais.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {OFFICIAL_CONNECTORS.map(([provider, name, description]) => {
          const connection = connections.find((item) => item.provider === provider);
          const status =
            connection?.status ??
            (provider === "DATAJUD_PUBLIC"
              ? CourtConnectorStatus.active
              : CourtConnectorStatus.requires_official_authorization);
          return (
            <Card key={provider}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <Badge variant="outline">
                  {status === "active" ? "Ativo" : status === "disabled" ? "Desativado" : "Preparado"}
                </Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {provider === "DATAJUD_PUBLIC"
                  ? "Consulta live depende da chave DataJud configurada no servidor."
                  : "Requer autorização oficial. O Lex não armazena senha, PIN, captcha ou credencial de advogado."}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
