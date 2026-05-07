import type { LegalChunkSection } from "@prisma/client";

export type LegalChunk = {
  text: string;
  label?: string;
  section: LegalChunkSection;
};

function extractArticleLabel(s: string): string | undefined {
  const m = s.match(/Art(?:igo)?\.?\s*(\d+)/i);
  return m ? `Art. ${m[1]}` : undefined;
}

function normalizeHeading(line: string): string {
  return line.replace(/^[\dIVXLC]+\s*[.—\-–]\s*/i, "").trim();
}

function detectSectionHeading(line: string): LegalChunkSection | null {
  const raw = line.trim();
  if (!raw || raw.length > 120) return null;
  const u = normalizeHeading(raw).toUpperCase();

  if (/\bPRELIMINAR/.test(u)) return "preliminaries";
  if (/^DOS?\s+FATOS\b/.test(u) || /^I+\s*[—\-–]\s*DOS?\s+FATOS/.test(u)) return "facts";
  if (/^DOS?\s+FUNDAMENTOS\b/.test(u) || /^DA\s+FUNDAMENTA/.test(u)) return "grounds";
  if (/^DO\s+DIREITO\b/.test(u)) return "legal_reasoning";
  if (/JURISPRUD/.test(u)) return "case_law";
  if (/^DOS?\s+PEDIDOS\b/.test(u)) return "requests";
  if (/^DISPOSITIVO/.test(u)) return "dispositive";
  if (/\bTESE(S)?\b/.test(u) && u.length < 72) return "thesis";

  return null;
}

function splitBySections(raw: string): Array<{ section: LegalChunkSection; body: string }> {
  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const segments: Array<{ section: LegalChunkSection; body: string }> = [];
  let current: LegalChunkSection = "generic";
  const buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    buf.length = 0;
    if (body) segments.push({ section: current, body });
  };

  for (const line of lines) {
    const detected = detectSectionHeading(line);
    if (detected !== null) {
      flush();
      current = detected;
      continue;
    }
    buf.push(line);
  }
  flush();

  if (segments.length === 0 && text.trim()) {
    return [{ section: "generic", body: text.trim() }];
  }
  return segments;
}

function windowChunk(
  s: string,
  maxChars: number,
  overlap: number,
  section: LegalChunkSection,
): LegalChunk[] {
  const out: LegalChunk[] = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(s.length, i + maxChars);
    let slice = s.slice(i, end);
    if (end < s.length) {
      const lastBreak = slice.lastIndexOf("\n\n");
      if (lastBreak > maxChars * 0.5) slice = slice.slice(0, lastBreak);
    }
    const t = slice.trim();
    if (t) out.push({ text: t, section });
    i += Math.max(1, slice.length - overlap);
  }
  return out;
}

function mergeSmallChunks(chunks: LegalChunk[], minSize: number): LegalChunk[] {
  const merged: LegalChunk[] = [];
  let buf = "";
  let label: string | undefined;
  let section: LegalChunkSection = "generic";
  for (const c of chunks) {
    if (!buf) {
      label = c.label;
      section = c.section;
    }
    buf += (buf ? "\n\n" : "") + c.text;
    if (buf.length >= minSize) {
      merged.push({ text: buf, label, section });
      buf = "";
      label = undefined;
      section = "generic";
    }
  }
  if (buf) merged.push({ text: buf, label, section });
  return merged;
}

function chunkSegmentBody(
  body: string,
  section: LegalChunkSection,
  maxChars: number,
  overlap: number,
): LegalChunk[] {
  const text = body.trim();
  if (!text) return [];

  const parts = text
    .split(/(?=\n\s*Art(?:igo)?\.?\s*\d+)/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const chunks: LegalChunk[] = [];
    for (const part of parts) {
      const label = extractArticleLabel(part);
      const effective: LegalChunkSection =
        label && section === "generic" ? "article_norm" : section;
      if (part.length <= maxChars) {
        chunks.push({ text: part, label, section: effective });
      } else {
        chunks.push(
          ...windowChunk(part, maxChars, overlap, effective).map((w) => ({
            ...w,
            label,
            section: effective,
          })),
        );
      }
    }
    return mergeSmallChunks(chunks, 400);
  }

  return mergeSmallChunks(windowChunk(text, maxChars, overlap, section), 400);
}

/**
 * Chunking jurídico semântico: detecta seções típicas (fatos, direito, pedidos, etc.)
 * e preserva cortes por artigo quando aplicável.
 */
export function chunkLegalText(raw: string, maxChars = 1800, overlap = 200): LegalChunk[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const segments = splitBySections(text);
  const out: LegalChunk[] = [];
  for (const seg of segments) {
    out.push(...chunkSegmentBody(seg.body, seg.section, maxChars, overlap));
  }
  return out;
}
