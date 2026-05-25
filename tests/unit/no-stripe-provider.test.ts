import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const UI_PATHS = walk(path.join(SRC, "app")).concat(walk(path.join(SRC, "components")));

describe("no-stripe-provider (JustOS Pro)", () => {
  it("proxy não isenta /api/stripe/webhook", () => {
    const proxy = fs.readFileSync(path.join(SRC, "proxy.ts"), "utf-8");
    expect(proxy).not.toMatch(/path\.startsWith\("\/api\/stripe\/webhook"\)/);
  });

  it("stripe webhook retorna 410 Gone", async () => {
    const mod = await import("@/app/api/stripe/webhook/route");
    const res = await mod.POST();
    expect(res.status).toBe(410);
  });

  it("UI JustOS não menciona Stripe como provider", () => {
    for (const file of UI_PATHS) {
      if (file.includes("stripe")) continue;
      const text = fs.readFileSync(file, "utf-8");
      expect(text, file).not.toMatch(/Stripe Checkout|Pagar com Stripe|via Stripe/i);
    }
  });

  it("barrel justos não exporta syncJustosProFromStripeEvent", () => {
    const idx = fs.readFileSync(path.join(SRC, "lib/justos/index.ts"), "utf-8");
    expect(idx).not.toMatch(/syncJustosProFromStripeEvent/);
  });
});
