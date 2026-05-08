import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(ROOT, rel), "utf-8");
}

describe("/api/inngest bundle safety", () => {
  it("route.ts não importa @/lib/parsers/extract-text no topo", async () => {
    const src = await read("src/app/api/inngest/route.ts");
    expect(src).not.toMatch(/from\s+["']@\/lib\/parsers\/extract-text["']/);
  });

  it("ingest-document.ts não importa extract-text no topo (deve ser lazy)", async () => {
    const src = await read("src/lib/inngest/functions/ingest-document.ts");
    // import top-level (não dentro de função): linha começa com `import ` e termina com extract-text
    const topLevel = src
      .split("\n")
      .filter((line) => /^\s*import\s+.+from\s+["']@\/lib\/parsers\/extract-text["']/.test(line));
    expect(topLevel).toHaveLength(0);
  });

  it("extract-text.ts não importa pdfjs-dist no topo", async () => {
    const src = await read("src/lib/parsers/extract-text.ts");
    expect(src).not.toMatch(/^\s*import\s+.+from\s+["']pdfjs-dist[^"']*["']/m);
  });

  it("extract-text.ts não importa tesseract.js no topo", async () => {
    const src = await read("src/lib/parsers/extract-text.ts");
    expect(src).not.toMatch(/^\s*import\s+.+from\s+["']tesseract\.js["']/m);
  });

  it("extract-text.ts não importa mammoth no topo", async () => {
    const src = await read("src/lib/parsers/extract-text.ts");
    expect(src).not.toMatch(/^\s*import\s+.+from\s+["']mammoth["']/m);
  });

  it("next.config.ts marca pdfjs/mammoth/tesseract/unpdf como serverExternalPackages", async () => {
    const src = await read("next.config.ts");
    expect(src).toMatch(/serverExternalPackages\s*:/);
    expect(src).toMatch(/["']unpdf["']/);
    expect(src).toMatch(/["']mammoth["']/);
    expect(src).toMatch(/["']tesseract\.js["']/);
  });
});
