/**
 * Revisão estática de logs/observabilidade (código; não imprime secrets).
 *
 *   npm run security:logs:review
 *
 * Variável opcional: LOGS_REVIEW_SCAN_ROOT (default: src/)
 */

import { resolve } from "node:path";
import {
  exitCodeFor,
  formatReport,
  scanDirectory,
  summarize,
} from "./logs-review-scan";

const ROOT = resolve(__dirname, "../..");
const scanRoot = process.env["LOGS_REVIEW_SCAN_ROOT"]?.trim() || resolve(ROOT, "src");
const label = scanRoot.includes("tests/fixtures") ? scanRoot.replace(ROOT + "/", "") : "src/";

function main() {
  const findings = scanDirectory(scanRoot);
  const summary = summarize(findings);
  for (const line of formatReport(summary, label)) {
    console.log(line);
  }
  process.exit(exitCodeFor(summary));
}

main();
