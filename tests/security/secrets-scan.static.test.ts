/**
 * FASE 5.1 D — Varredura estática de secrets (sem imprimir valores).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readText(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

function walk(relDir: string, out: string[] = []): string[] {
  const dir = resolve(root, relDir);
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(join(relDir, name), out);
    else if (/\.(ts|tsx|yml|yaml|md|example)$/.test(name)) out.push(p);
  }
  return out;
}

describe("FASE 5.1 — Secrets scan (estático)", () => {
  it("SC.1 .env não está versionado no gitignore", () => {
    const gi = readText(".gitignore");
    expect(gi).toMatch(/^\.env$/m);
    expect(gi).toMatch(/\.env\*\.local|\.env\.local/);
  });

  it("SC.2 .env.example sem valores reais de API key", () => {
    const ex = readText(".env.example");
    expect(ex).not.toMatch(/DEEPSEEK_API_KEY=sk-[a-z0-9]/i);
    expect(ex).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJ/);
    expect(ex).toMatch(/DEEPSEEK_API_KEY=\s*$/m);
  });

  it("SC.3 .env.production.example só placeholders (…), sem JWT/API key real", () => {
    const ex = readText(".env.production.example");
    expect(ex).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJ[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]+\./);
    expect(ex).not.toMatch(/DEEPSEEK_API_KEY=sk-[a-z0-9]{16,}/i);
    expect(ex).toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJhbGci[A-Za-z0-9]*\.\.\./);
  });

  it("SC.4 src/ sem NEXT_PUBLIC_* com service role ou secret", () => {
    const hits: string[] = [];
    for (const file of walk("src")) {
      const rel = file.replace(root + "/", "");
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SERVICE_KEY|SECRET|DEEPSEEK|OPENAI_API)/i.test(line)) {
          hits.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it("SC.5 workflows CI sem echo de secrets", () => {
    const wfDir = resolve(root, ".github/workflows");
    if (!existsSync(wfDir)) return;
    const bad: string[] = [];
    for (const name of readdirSync(wfDir)) {
      if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
      const text = readFileSync(join(wfDir, name), "utf8");
      if (/echo\s+\$\{\{\s*secrets\./i.test(text)) bad.push(name);
    }
    expect(bad).toEqual([]);
  });

  it("SC.6 service role só em lib server (não em app/api direto)", () => {
    const hits: string[] = [];
    for (const file of walk("src/app")) {
      const rel = file.replace(root + "/", "");
      if (/createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(file, "utf8"))) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
