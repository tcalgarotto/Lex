/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * Exportação de peça (DOCX/PDF). POST espelha GET com corpo JSON (formato).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { tiptapPlainText } from "@/lib/editor/tiptap-to-text";
import { buildDocxBuffer, buildPdfBuffer } from "@/lib/cases/drafting/drafting-markdown-export";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, " ").trim() || "lex";
}

const PostSchema = z.object({
  format: z.enum(["docx", "pdf"]).default("docx"),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "docx").toLowerCase();

  const piece = await prisma.legalPiece.findFirst({
    where: { id, workspaceId },
    select: { id: true, title: true, kind: true, contentJson: true },
  });
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada" }, { status: 404 });
  }

  const plain = tiptapPlainText(piece.contentJson as Record<string, unknown>);
  const baseName = safeFileName(piece.title || piece.kind || "peca");
  const title = (piece.title || piece.kind || "Peça").trim();
  const subtitle = `Peça · ${piece.kind ?? "documento"}`;

  if (format === "docx") {
    const buf = await buildDocxBuffer({ markdown: plain, title, subtitle });
    return new Response(Buffer.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${baseName}.docx\"`,
      },
    });
  }

  if (format === "pdf") {
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

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "piece-export",
  });
  if (limited) return limited;

  const json = await req.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.message }, { status: 400 });
  }

  const piece = await prisma.legalPiece.findFirst({
    where: { id, workspaceId },
    select: { id: true, title: true, kind: true, contentJson: true },
  });
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada" }, { status: 404 });
  }

  const plain = tiptapPlainText(piece.contentJson as Record<string, unknown>);
  const baseName = safeFileName(piece.title || piece.kind || "peca");
  const title = (piece.title || piece.kind || "Peça").trim();
  const subtitle = `Peça · ${piece.kind ?? "documento"}`;
  const format = parsed.data.format;

  if (format === "docx") {
    const buf = await buildDocxBuffer({ markdown: plain, title, subtitle });
    return new Response(Buffer.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${baseName}.docx\"`,
      },
    });
  }

  const buf = await buildPdfBuffer({ markdown: plain, title, subtitle });
  return new Response(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${baseName}.pdf\"`,
    },
  });
}
