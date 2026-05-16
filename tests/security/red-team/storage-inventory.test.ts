/**
 * FASE 3 — Inventário estático de Storage / service_role (sem rede).
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { RedTeamReport } from "./helpers";

const report = new RedTeamReport();
const src = resolve(process.cwd(), "src");

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules") walkTs(p, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

function scan(pattern: RegExp): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of walkTs(src)) {
    const rel = file.replace(src + "/", "");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push({ file: rel, line: i + 1, text: line.trim() });
    });
  }
  return hits;
}

afterAll(() => report.print());

describe("FASE 3 — Storage inventory", () => {
  it("INV.1 createSupabaseAdminClient só em lib server", () => {
    const hits = scan(/createSupabaseAdminClient/);
    const inApp = hits.filter((h) => h.file.startsWith("app/"));
    expect(inApp).toHaveLength(0);
    report.pass(`INV.1 admin client: ${hits.length} uso(s), 0 em app/`, {
      obtained: hits.map((h) => `${h.file}:${h.line}`).join(" | ") || "nenhum",
    });
  });

  it("INV.2 sem createSignedUrl no repositório", () => {
    const hits = scan(/createSignedUrl|signedUrl|signed_url/i);
    expect(hits).toHaveLength(0);
    report.pass("INV.2 nenhuma signed URL gerada no código");
  });

  it("INV.3 downloadDocumentBuffer só após rotas com auth (amostra)", () => {
    const downloads = scan(/downloadDocumentBuffer/);
    const routes = downloads.filter((h) => h.file.includes("app/api"));
    for (const r of routes) {
      expect(r.file).toMatch(/documents\/\[documentId\]\/(file|thumbnail)/);
    }
    report.pass(`INV.3 ${downloads.length} chamadas downloadDocumentBuffer mapeadas`);
  });

  it("INV.4 storage path inclui workspaceId no helper", () => {
    const storageTs = readFileSync(resolve(src, "lib/storage.ts"), "utf8");
    expect(storageTs).toMatch(/workspaceId.*documentId/);
    report.pass("INV.4 documentStoragePath usa workspaceId/documentId");
  });
});
