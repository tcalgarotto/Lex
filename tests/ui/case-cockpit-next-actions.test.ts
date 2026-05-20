import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_CTA_FORBIDDEN_HREF_PATTERNS } from "@/lib/cases/case-cockpit-routes";

const nextActionsSrc = readFileSync(
  join(process.cwd(), "src/lib/dashboard/next-actions.ts"),
  "utf8",
);

const morningSrc = readFileSync(
  join(process.cwd(), "src/lib/dashboard/morning-briefing-data.ts"),
  "utf8",
);

describe("dashboard next actions (case context)", () => {
  it("links cases needing strategy to in-case estrategia", () => {
    expect(nextActionsSrc).toContain("href: `/cases/${c.id}/estrategia`");
    expect(nextActionsSrc).not.toMatch(/\/strategy\?caseId/);
  });

  it("ready-for-facts links to partes-fatos when caseId exists", () => {
    expect(nextActionsSrc).toContain("href: d.caseId ? `/cases/${d.caseId}/partes-fatos`");
  });

  it("morning briefing CNJ action uses case processo tab", () => {
    expect(morningSrc).toContain("href: `/cases/${c.id}/processo`");
    expect(morningSrc).not.toMatch(/href: `\/processos\?returnCase=\$\{c\.id\}`/);
  });

  it("does not use forbidden global CTA patterns", () => {
    for (const pattern of CASE_CTA_FORBIDDEN_HREF_PATTERNS) {
      expect(nextActionsSrc).not.toMatch(pattern);
      expect(morningSrc).not.toMatch(pattern);
    }
  });
});
