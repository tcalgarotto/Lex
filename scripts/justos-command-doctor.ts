#!/usr/bin/env npx tsx
import { readJustosCommandUrl } from "../src/lib/justos/env";

const base = (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");

async function main() {
  console.log("=== JustOS Command Doctor ===\n", base);
  try {
    const h = await fetch(`${base}/health`);
    console.log("health:", await h.text());
    const r = await fetch(`${base}/ready`);
    console.log("ready:", await r.text());
  } catch (e) {
    console.error("OFFLINE", e);
    process.exit(1);
  }
}

main();
