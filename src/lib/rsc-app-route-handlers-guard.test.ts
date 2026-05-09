import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.join(process.cwd(), "src", "app");

/** Eventos JSX que exigem Client Component no App Router. */
const HANDLER_RE = /\bon(Blur|Click|Change|Submit|Focus|KeyDown|KeyUp)\s*=\s*\{/;

function stripLeadingComments(src: string): string {
  let s = src.replace(/^\uFEFF/, "").trimStart();
  for (;;) {
    if (s.startsWith("/*")) {
      const end = s.indexOf("*/");
      if (end === -1) break;
      s = s.slice(end + 2).trimStart();
      continue;
    }
    if (s.startsWith("//")) {
      const nl = s.indexOf("\n");
      if (nl === -1) return "";
      s = s.slice(nl + 1).trimStart();
      continue;
    }
    break;
  }
  return s;
}

function hasUseClientDirective(src: string): boolean {
  const s = stripLeadingComments(src);
  return /^(['"])use client\1\s*;/.test(s);
}

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      collectRouteFiles(full, acc);
    } else if (ent.isFile() && ent.name.endsWith(".tsx")) {
      if (["page.tsx", "layout.tsx", "not-found.tsx", "error.tsx"].includes(ent.name)) {
        acc.push(full);
      }
    }
  }
  return acc;
}

describe("App Router: Server Components não declaram handlers JSX", () => {
  it("page/layout/not-found/error sem \"use client\" não contêm onBlur/onClick/…", () => {
    const files = collectRouteFiles(APP_ROOT);
    const violations: string[] = [];
    for (const abs of files) {
      const src = fs.readFileSync(abs, "utf8");
      if (hasUseClientDirective(src)) continue;
      if (!HANDLER_RE.test(src)) continue;
      violations.push(path.relative(process.cwd(), abs));
    }
    expect(
      violations,
      `Mover interação para Client Component (ex.: padrão CnjInput). Violações:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
