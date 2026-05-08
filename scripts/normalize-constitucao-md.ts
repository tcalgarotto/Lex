import { readFile, writeFile } from "node:fs/promises";

type ContextKey = string;

function isTopHeading(line: string): { level: 1 | 2; text: string } | null {
  const m = line.match(/^(#{1,2})\s+(.+?)\s*$/);
  if (!m) return null;
  const level = m[1].length as 1 | 2;
  return { level, text: m[2] };
}

function parseBoldArticle(line: string): { label: string; rest: string; id: string } | null {
  const m = line.match(/^\s*\*\*\s*(Art\.?\s*[^*]+?)\s*\*\*\s*(.*)$/i);
  if (!m) return null;
  const label = m[1].trim();
  if (!/^Art\.?/i.test(label)) return null;
  const rest = m[2] ?? "";
  const id = label
    .replace(/^Art\.?\s*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[º°]/g, "")
    .replace(/\.$/, "");
  if (!id) return null;
  return { label, rest, id };
}

function parseBoldParagraph(line: string): { label: string; rest: string; id: string } | null {
  const m = line.match(/^\s*\*\*\s*(§\s*[^*]+?)\s*\*\*\s*(.*)$/i);
  if (!m) return null;
  const label = m[1].trim();
  if (!/^§/i.test(label)) return null;
  const rest = m[2] ?? "";
  const id = label
    .replace(/^§\s*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[º°]/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!id) return null;
  return { label, rest, id };
}

function isAnyArticleLine(line: string): boolean {
  return parseBoldArticle(line) !== null;
}

function isAnyParagraphLine(line: string): boolean {
  return parseBoldParagraph(line) !== null;
}

function toHeading(prefix: string, label: string, rest: string): string {
  const trimmedRest = rest.trim();
  return trimmedRest ? `${prefix} ${label} ${trimmedRest}` : `${prefix} ${label}`;
}

function normalizeLines(input: string): string {
  const lines = input.split(/\r?\n/);

  // Track context using last H1/H2 only (keeps Constituição vs ADCT distinct).
  let currentContext: ContextKey = "__root__";

  const articleLastIndex = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const top = isTopHeading(lines[i]);
    if (top) currentContext = `${top.level}:${top.text}`;

    const art = parseBoldArticle(lines[i]);
    if (!art) continue;

    const key = `${currentContext}::${art.id}`;
    articleLastIndex.set(key, i);
  }

  // Second pass: emit lines, skipping non-last article blocks; within kept article blocks,
  // skip non-last paragraph blocks.
  const out: string[] = [];
  currentContext = "__root__";

  let i = 0;
  while (i < lines.length) {
    const top = isTopHeading(lines[i]);
    if (top) currentContext = `${top.level}:${top.text}`;

    const art = parseBoldArticle(lines[i]);
    if (!art) {
      // Promote paragraphs that are outside an article anyway (rare, but keep consistent)
      const par = parseBoldParagraph(lines[i]);
      if (par) out.push(toHeading("#####", par.label, par.rest));
      else out.push(lines[i]);
      i++;
      continue;
    }

    const artKey = `${currentContext}::${art.id}`;
    const keepThisArticle = articleLastIndex.get(artKey) === i;

    // Find end of this article block: next article OR next H1/H2.
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (isTopHeading(lines[j])) break;
      if (isAnyArticleLine(lines[j])) break;
    }

    if (!keepThisArticle) {
      i = j;
      continue;
    }

    // Convert the article header line.
    out.push(toHeading("####", art.label, art.rest));

    // For the rest of the block, dedupe paragraphs by keeping last occurrence per id.
    const paragraphLastIndex = new Map<string, number>();
    for (let k = i + 1; k < j; k++) {
      const par = parseBoldParagraph(lines[k]);
      if (!par) continue;
      paragraphLastIndex.set(par.id, k);
    }

    let k = i + 1;
    while (k < j) {
      const par = parseBoldParagraph(lines[k]);
      if (!par) {
        out.push(lines[k]);
        k++;
        continue;
      }

      const keepPar = paragraphLastIndex.get(par.id) === k;

      // Paragraph block ends at next paragraph OR next article boundary (j).
      let pEnd = k + 1;
      for (; pEnd < j; pEnd++) {
        if (isAnyParagraphLine(lines[pEnd])) break;
      }

      if (!keepPar) {
        k = pEnd;
        continue;
      }

      out.push(toHeading("#####", par.label, par.rest));
      for (let t = k + 1; t < pEnd; t++) out.push(lines[t]);
      k = pEnd;
    }

    i = j;
  }

  return out.join("\n");
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error("Usage: tsx scripts/normalize-constitucao-md.ts <path-to-md>");
    process.exit(2);
  }

  const original = await readFile(targetPath, "utf8");
  const normalized = normalizeLines(original);
  if (normalized === original) {
    console.log("No changes needed.");
    return;
  }

  await writeFile(targetPath, normalized, "utf8");
  console.log("Normalized:", targetPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

