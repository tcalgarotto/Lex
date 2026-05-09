import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.cases.legal-sources");

/**
 * Persistência de fundamentos jurídicos pinados em um caso.
 *
 *  - POST   `{ chunkId, normUrn?, articleRef?, excerpt, query? }` → cria.
 *  - DELETE `?id=...` → remove um pin específico.
 *  - GET    → lista pins do caso (ordem desc por createdAt).
 *
 * Sempre escopa por workspaceId via Case.workspaceId. Idempotente em POST
 * via `@@unique([caseId, chunkId])` (HTTP 409 se já existe).
 */

const postSchema = z.object({
  chunkId: z.string().min(1),
  normUrn: z.string().optional(),
  articleRef: z.string().optional(),
  excerpt: z.string().min(1).max(2000),
  query: z.string().optional(),
});

async function ensureCase(workspaceId: string, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  return c?.id ?? null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, id))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const created = await prisma.caseLegalSource.create({
      data: {
        caseId: id,
        chunkId: parsed.data.chunkId,
        excerpt: parsed.data.excerpt,
        ...(parsed.data.normUrn ? { normUrn: parsed.data.normUrn } : {}),
        ...(parsed.data.articleRef ? { articleRef: parsed.data.articleRef } : {}),
        ...(parsed.data.query ? { query: parsed.data.query } : {}),
        ...(user?.id ? { pinnedById: user.id } : {}),
      },
    });
    return NextResponse.json({ ok: true, source: created });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Fundamento já está pinado neste caso." },
        { status: 409 },
      );
    }
    log.error("POST pin failed", {
      workspaceId,
      caseId: id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
    return NextResponse.json({ error: "Erro ao pinar fundamento" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, id))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const sources = await prisma.caseLegalSource.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ sources });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, id))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const url = new URL(req.url);
  const sourceId = url.searchParams.get("id");
  if (!sourceId) {
    return NextResponse.json({ error: "id ausente" }, { status: 400 });
  }

  const result = await prisma.caseLegalSource.deleteMany({
    where: { id: sourceId, caseId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Fundamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
