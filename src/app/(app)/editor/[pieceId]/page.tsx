import Link from "next/link";
import { notFound } from "next/navigation";
import { SetPageTitle } from "@/components/app/set-page-title";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalEditorLazy } from "@/components/editor/legal-editor-lazy";
import { Button } from "@/components/ui/button";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ pieceId: string }>;
}) {
  const { pieceId } = await params;
  const { workspaceId } = await getWorkspaceContext();

  const piece = await prisma.legalPiece.findFirst({
    where: { id: pieceId, workspaceId },
  });
  if (!piece) notFound();

  const initial = piece.contentJson as Record<string, unknown>;
  const aiMeta = piece.aiMetaJson as Record<string, unknown> | null;

  return (
    <>
      <SetPageTitle title={piece.title} />
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {piece.kind}{" "}
          {piece.processId ? (
            <Link href={`/processos/${piece.processId}`} className="text-violet-400 hover:underline">
              · processo
            </Link>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={piece.processId ? `/processos/${piece.processId}` : "/processos"}>
              Voltar
            </Link>
          </Button>
        </div>
      </div>
      <LegalEditorLazy
        pieceId={piece.id}
        initialContent={initial}
        processId={piece.processId}
        aiMeta={aiMeta}
      />
    </>
  );
}

