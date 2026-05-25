#!/usr/bin/env node
/**
 * Roda o detector Impeccable (bundled em node_modules) na superfície marketing.
 * Exit 0 = limpo, 2 = achados (padrão do upstream).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const detector = path.join(
  root,
  "node_modules/impeccable/cli/engine/detect-antipatterns.mjs",
);
const targets = [
  "src/components/marketing",
  "src/app/(marketing)",
];

const extra = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [detector, "--json", ...targets, ...extra],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
