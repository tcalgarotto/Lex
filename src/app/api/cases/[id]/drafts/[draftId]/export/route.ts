/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * GET/POST — exporta minuta em DOCX, PDF ou Markdown (estrutura preservada).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildDocxBuffer, buildPdfBuffer } from "@/lib/cases/drafting/drafting-markdown-export";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, " ").trim() || "lex";
}

const PostSchema = z.object({
  format: z.enum(["docx", "pdf", "markdown", "md"]).default("docx"),
});

async function exportResponse(args: {
  caseId: string;
  draftId: string;
  workspaceId: string;
  format: string;
}) {
  const c = await prisma.case.findFirst({
    where: { id: args.caseId, workspaceId: args.workspaceId },
    select: { id: true, title: true, processNumber: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: args.draftId, caseId: args.caseId },
    select: { id: true, version: true, content: true, createdAt: true },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const title = c.title?.trim() || "Minuta";
  const baseName = safeFileName(`${title} v${draft.version}`);
  const plain = draft.content;
  const fmt = args.format.toLowerCase();
  const subtitle = `Minuta v${draft.version}${c.processNumber ? ` · Processo ${c.processNumber}` : ""}`;

  if (fmt === "md" || fmt === "markdown") {
    return new Response(plain, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${baseName}.md\"`,
      },
    });
  }

  if (fmt === "docx") {
    const buf = await buildDocxBuffer({ markdown: plain, title, subtitle });
    return new Response(Buffer.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${baseName}.docx\"`,
      },
    });
  }

  if (fmt === "pdf") {
    const buf = await buildPdfBuffer({ markdown: plain, title, subtitle });
    return new Response(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${baseName}.pdf\"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; draftId: string }> },
) {
  const { id: caseId, draftId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "docx").toLowerCase();
  return exportResponse({ caseId, draftId, workspaceId, format });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await context.params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-export",
  });
  if (limited) return limited;

  const json = await req.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.message }, { status: 400 });
  }

  const format = parsed.data.format === "md" ? "markdown" : parsed.data.format;
  return exportResponse({ caseId, draftId, workspaceId, format });
}
