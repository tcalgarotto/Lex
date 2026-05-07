import { createHash } from "node:crypto";

/** Hash estável para deduplicação de chunks (normalização leve). */
export function sha256Hex(text: string): string {
  const n = text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return createHash("sha256").update(n, "utf8").digest("hex");
}
