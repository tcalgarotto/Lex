import { NextResponse } from "next/server";
import {
  AlignmentType,
  Document as DocxDocument,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  context: { params: Promise<{ id: string; draftId: string }> },
) {
  const { id: caseId, draftId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "docx").toLowerCase();

  // Validação obrigatória: case.workspaceId / draftId / caseId.
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, title: true, processNumber: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
    select: { id: true, version: true, content: true, createdAt: true },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const title = c.title?.trim() || "Minuta";
  const baseName = safeFileName(`${title} v${draft.version}`);
  const plain = draft.content;

  if (format === "md" || format === "markdown") {
    return new Response(plain, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${baseName}.md\"`,
      },
    });
  }

  if (format === "docx") {
    const paragraphs: Paragraph[] = [];
    const headerTitle = title;
    const headerMeta = `Minuta v${draft.version}${c.processNumber ? ` · Processo ${c.processNumber}` : ""}`;

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: headerTitle, bold: true })],
      }),
    );
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 320 },
        children: [new TextRun({ text: headerMeta, size: 18 })],
      }),
    );

    const lines = plain.split("\n").map((l) => l.trimEnd());
    for (const l of lines) {
      if (!l) {
        paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }
      const isHeading = /^##\s+/.test(l) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .\-]{6,}$/.test(l);
      paragraphs.push(
        new Paragraph({
          spacing: { after: isHeading ? 220 : 140, before: isHeading ? 140 : 0, line: 360 },
          children: [
            new TextRun({
              text: l.replace(/^#+\s*/, ""),
              bold: isHeading,
            }),
          ],
        }),
      );
    }

    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
            new TextRun({ text: " de ", size: 18 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
          ],
        }),
      ],
    });

    const doc = new DocxDocument({
      sections: [
        {
          properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } },
          footers: { default: footer },
          children: paragraphs,
        },
      ],
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
    const pages = [page];
    let y = pageHeight - margin;

    page.drawText(title, { x: margin, y, size: 14, font: fontBold });
    y -= 20;
    page.drawText(`Minuta v${draft.version}`, { x: margin, y, size: 10, font });
    y -= 22;

    const lines = splitLinesForPdf(plain, 95);
    for (const line of lines) {
      // Widow/orphan heuristic: se restarem <2 linhas na página, quebra antes.
      if (y < margin + lineHeight * 2) {
        page = pdf.addPage([pageWidth, pageHeight]);
        pages.push(page);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }

    // Rodapé com paginação.
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]!;
      const footer = `Página ${i + 1} de ${pages.length}`;
      p.drawText(footer, { x: margin, y: margin - 22, size: 9, font });
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

