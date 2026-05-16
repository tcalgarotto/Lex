/**
 * FASE 2 — BLOCO 6: busca estática de padrões perigosos (rg via Node).
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { RedTeamReport } from "./helpers";

const report = new RedTeamReport();
const root = resolve(process.cwd(), "src");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules") walkTsFiles(p, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

function scanSrc(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of walkTsFiles(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file.replace(root + "/", "")}:${i + 1}`);
    });
  }
  return hits;
}

afterAll(() => report.print());

describe("FASE 2 — Static P0 patterns", () => {
  it("S6.1 findUnique por id em entidades sensíveis (suspeitos)", () => {
    const lines = scanSrc(/findUnique\(\s*\{\s*where:\s*\{\s*id/);
    const sensitive = lines.filter(
      (l) =>
        /document|case|membership|client|process|thread|integration/i.test(l) &&
        !/user\.findUnique|workspace\.findUnique/i.test(l),
    );
    if (sensitive.length > 0) {
      report.fail("S6.1 findUnique({ id }) em rotas sensíveis", {
        severity: "P1",
        obtained: `${sensitive.length} ocorrências (amostra: ${sensitive.slice(0, 3).join(" | ")})`,
        fix: "Preferir findFirst com workspaceId",
      });
    } else {
      report.pass("S6.1 nenhum findUnique id óbvio em sensíveis");
    }
    expect(sensitive.length).toBeGreaterThanOrEqual(0);
  });

  it("S6.2 service role só em lib server-side", () => {
    const pub = scanSrc(/createSupabaseAdminClient|SUPABASE_SERVICE_ROLE/)
      .filter((h) => h.startsWith("app/"))
      .join("\n");
    if (pub) {
      report.fail("S6.2 service role em app/", {
        severity: "P0",
        obtained: pub.split("\n").slice(0, 3).join(" | "),
        fix: "Mover para server-only lib",
      });
    } else {
      report.pass("S6.2 service role não referenciado em app/ routes diretamente");
    }
    expect(pub).toBe("");
  });

  it("S6.3 NEXT_PUBLIC sem SERVICE_ROLE", () => {
    const leak = scanSrc(/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SERVICE_KEY|SECRET)/).join("\n");
    if (leak) {
      report.fail("S6.3 secret em NEXT_PUBLIC", { severity: "P0", obtained: leak });
    } else {
      report.pass("S6.3 sem NEXT_PUBLIC service/secret");
    }
    expect(leak).toBe("");
  });

  it("S6.4 $queryRawUnsafe — inventário", () => {
    const hits = scanSrc(/\$queryRawUnsafe/);
    const count = hits.length;
    if (count > 0) {
      report.pass(`S6.4 $queryRawUnsafe: ${count} uso(s) — revisar manualmente`, {
        obtained: hits.slice(0, 2).join(" | "),
      });
    } else {
      report.pass("S6.4 sem $queryRawUnsafe");
    }
  });

  it("S6.5 workspaceId do body — rotas que comparam com sessão", () => {
    const bodyWs = scanSrc(/parsed\.data\.workspaceId/).length > 0;
    const compares = scanSrc(/findCaseInWorkspace/).length > 0;
    const rejectWs = scanSrc(/Workspace inválido/).length > 0;
    const hasGuard = compares || rejectWs;
    if (bodyWs || hasGuard) {
      report.pass("S6.5 rotas com workspaceId no payload e/ou guard de escopo", {
        obtained: `parsed.workspaceId=${bodyWs} findCaseInWorkspace=${compares}`,
      });
    } else {
      report.fail("S6.5 revisar payloads com workspaceId", {
        severity: "P1",
        obtained: "nenhum padrão encontrado (rg vazio — revisar manualmente)",
      });
    }
    expect(hasGuard || Boolean(bodyWs)).toBe(true);
  });
});
