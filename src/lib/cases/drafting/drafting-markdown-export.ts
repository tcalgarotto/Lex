/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import {
  AlignmentType,
  Document as DocxDocument,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportKind = "docx" | "pdf" | "markdown";

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

function markdownToDocxParagraphs(markdown: string, title: string, subtitle: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: title, bold: true })],
    }),
  );
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [new TextRun({ text: subtitle, italics: true, size: 18 })],
    }),
  );

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }
    if (/^###\s+/.test(line)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 120 },
          text: line.replace(/^###\s+/, ""),
        }),
      );
      continue;
    }
    if (/^##\s+/.test(line)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 140 },
          text: line.replace(/^##\s+/, ""),
        }),
      );
      continue;
    }
    if (/^#\s+/.test(line)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 220, after: 160 },
          text: line.replace(/^#\s+/, ""),
        }),
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = line.replace(/^>\s?/, "");
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 140 },
          indent: { left: 400 },
          children: [new TextRun({ text: q, italics: true })],
        }),
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const item = line.replace(/^[-*]\s+/, "");
      paragraphs.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `• ${item}` })],
        }),
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({
        spacing: { after: 140, line: 360 },
        children: [new TextRun({ text: line })],
      }),
    );
  }
  return paragraphs;
}

export async function buildDocxBuffer(args: {
  markdown: string;
  title: string;
  subtitle: string;
}): Promise<Uint8Array> {
  const children = markdownToDocxParagraphs(args.markdown, args.title, args.subtitle);
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
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export async function buildPdfBuffer(args: {
  markdown: string;
  title: string;
  subtitle: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const fontSize = 11;
  const lineHeight = 14;
  const margin = 54;
  const pageWidth = 595;
  const pageHeight = 842;

  let page = pdf.addPage([pageWidth, pageHeight]);
  const pages = [page];
  let y = pageHeight - margin;

  page.drawText(args.title, { x: margin, y, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.12) });
  y -= 20;
  page.drawText(args.subtitle, { x: margin, y, size: 10, font: fontItalic, color: rgb(0.2, 0.2, 0.24) });
  y -= 24;

  for (const raw of args.markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line) {
      y -= lineHeight * 0.6;
      continue;
    }
    const isH1 = /^#\s+/.test(line);
    const isH2 = /^##\s+/.test(line);
    const isH3 = /^###\s+/.test(line);
    const isQuote = /^>\s?/.test(line);
    const isBullet = /^[-*]\s+/.test(line);
    const draw = line
      .replace(/^#{1,3}\s+/, "")
      .replace(/^>\s?/, "")
      .replace(/^[-*]\s+/, "• ");
    const useFont = isH1 || isH2 ? fontBold : isQuote ? fontItalic : font;
    const size = isH1 ? 13 : isH2 ? 12 : isH3 ? 11.5 : fontSize;
    const lines = splitLinesForPdf(draw, 95);
    for (const part of lines) {
      if (y < margin + lineHeight * 2) {
        page = pdf.addPage([pageWidth, pageHeight]);
        pages.push(page);
        y = pageHeight - margin;
      }
      page.drawText(part, { x: margin + (isBullet ? 10 : 0), y, size, font: useFont });
      y -= lineHeight + (isH1 ? 4 : 0);
    }
  }

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const footer = `Página ${i + 1} de ${pages.length}`;
    p.drawText(footer, { x: margin, y: margin - 22, size: 9, font, color: rgb(0.35, 0.35, 0.38) });
  }

  // TODO Lane E: PDF com marcação estruturada (tagged) se biblioteca suportar sem regressão visual.
  const bytes = await pdf.save();
  return bytes;
}
