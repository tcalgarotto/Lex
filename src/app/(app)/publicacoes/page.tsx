import { revalidatePath } from "next/cache";
import { OfficialCommunicationSource } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOfficialCommunication,
  normalizeOfficialCommunicationSource,
  normalizeOfficialCommunicationType,
  parseOfficialCommunicationDate,
} from "@/lib/official-communications/service";

export const dynamic = "force-dynamic";

async function createPublicationAction(formData: FormData) {
  "use server";
  const { workspaceId, user } = await getWorkspaceContext();
  await createOfficialCommunication({
    workspaceId,
    createdByUserId: user.id,
    source: normalizeOfficialCommunicationSource(formData.get("source")),
    communicationType: normalizeOfficialCommunicationType(formData.get("communicationType")),
    receivedAt: parseOfficialCommunicationDate(formData.get("receivedAt")),
    dueReviewAt: parseOfficialCommunicationDate(formData.get("dueReviewAt")),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    rawText: String(formData.get("rawText") ?? "").trim() || null,
  });
  revalidatePath("/publicacoes");
  revalidatePath("/dashboard");
}

export default async function PublicacoesPage() {
  const { workspaceId } = await getWorkspaceContext();
  const publications = await prisma.officialCommunication.findMany({
    where: {
      workspaceId,
      source: {
        in: [
          OfficialCommunicationSource.DJEN,
          OfficialCommunicationSource.OFFICIAL_GAZETTE,
          OfficialCommunicationSource.TRIBUNAL_PUBLIC_QUERY,
          OfficialCommunicationSource.OTHER_OFFICIAL,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Publicações oficiais</h1>
        <p className="text-sm text-muted-foreground">
          Busque/import manual de DJEN, diários e comunicações públicas. Toda publicação exige revisão no portal oficial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar publicação/comunicação oficial</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPublicationAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="source">Fonte</Label>
              <select id="source" name="source" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="DJEN">DJEN / Comunicações Processuais</option>
                <option value="OFFICIAL_GAZETTE">Diário oficial público</option>
                <option value="TRIBUNAL_PUBLIC_QUERY">Portal do tribunal</option>
                <option value="OTHER_OFFICIAL">Outra fonte oficial</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="communicationType">Tipo</Label>
              <select id="communicationType" name="communicationType" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="PUBLICACAO">Publicação</option>
                <option value="INTIMACAO">Intimação</option>
                <option value="CITACAO">Citação</option>
                <option value="OFICIO">Ofício</option>
                <option value="AUDIENCIA">Audiência</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="receivedAt">Data de publicação/recebimento</Label>
              <Input id="receivedAt" name="receivedAt" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueReviewAt">Revisar até</Label>
              <Input id="dueReviewAt" name="dueReviewAt" type="date" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required placeholder="Ex.: Publicação DJEN sobre intimação" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="description">Resumo</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="rawText">Texto colado da fonte oficial</Label>
              <Textarea id="rawText" name="rawText" rows={5} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Registrar para revisão humana</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos registros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {publications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma publicação oficial registrada ainda.</p>
          ) : null}
          {publications.map((publication) => (
            <div key={publication.id} className="rounded-xl border border-[color:var(--border-default)] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{publication.title}</p>
                <Badge variant="outline">{publication.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {publication.source} · {publication.communicationType} · revise no portal oficial
              </p>
              {publication.description ? <p className="mt-2 text-muted-foreground">{publication.description}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
