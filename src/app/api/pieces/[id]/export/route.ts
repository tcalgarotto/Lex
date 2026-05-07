import { NextResponse } from "next/server";
import { AlignmentType, Packer, Document as DocxDocument, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { tiptapPlainText } from "@/lib/editor/tiptap-to-text";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, " ").trim() || "lex";
}

function splitLinesForPdf(text: string, maxChars = 95): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      lines.push("");
      continue;
    }
    let rest = line;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const idx = cut > 40 ? cut : maxChars;
      lines.push(rest.slice(0, idx).trimEnd());
      rest = rest.slice(idx).trimStart();
    }
    lines.push(rest);
  }
  return lines;
}

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

  if (format === "docx") {
    const paragraphs: Paragraph[] = [];
    const title = (piece.title || piece.kind || "Peça").trim();

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: title, bold: true })],
      }),
    );

    const lines = plain.split("\n").map((l) => l.trimEnd());
    for (const l of lines) {
      if (!l) {
        paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }
      const isHeading =
        /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .\-]{6,}$/.test(l) || /^(\d+(\.\d+)*)\s+/.test(l);
      paragraphs.push(
        new Paragraph({
          spacing: { after: isHeading ? 200 : 140, before: isHeading ? 140 : 0, line: 360 },
          children: [
            new TextRun({
              text: l.replace(/^#+\s*/, ""),
              bold: isHeading,
            }),
          ],
        }),
      );
    }
    const doc = new DocxDocument({
      sections: [{ properties: {}, children: paragraphs }],
    });
    const buf = await Packer.toBuffer(doc);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${baseName}.docx\"`,
      },
    });
  }

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const fontSize = 11;
    const lineHeight = 14;
    const margin = 54;
    const pageWidth = 595; // A4 portrait width in points approx
    const pageHeight = 842;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const title = (piece.title || piece.kind || "Peça").trim();
    page.drawText(title, { x: margin, y, size: 14, font: fontBold });
    y -= 26;
    const lines = splitLinesForPdf(plain, 95);

    for (const line of lines) {
      if (y < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
      });
      y -= lineHeight;
    }

    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${baseName}.pdf\"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
}

