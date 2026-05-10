/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { CaseDraftStatus, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enforceDraftingRateLimit, loadCaseScoped } from "@/lib/cases/drafting/drafting-route-common";

export const dynamic = "force-dynamic";

const STARTER = `# Minuta

_Em elaboração — preencha com geração assistida ou edição manual._

## Lacunas para revisão

- Confirmar endereçamento e juízo competente após revisão humana.
`;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "drafts-list",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const drafts = await prisma.caseDraft.findMany({
    where: { caseId: c.id },
    orderBy: { version: "desc" },
  });
  return NextResponse.json({ drafts });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "drafts-create",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const last = await prisma.caseDraft.findFirst({
    where: { caseId: c.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const draft = await prisma.caseDraft.create({
    data: {
      caseId: c.id,
      version,
      status: CaseDraftStatus.PENDING,
      content: STARTER,
      groundingChunkIds: [],
      metadataJson: { createdVia: "drafting-tab-p0" } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ draft }, { status: 201 });
}
