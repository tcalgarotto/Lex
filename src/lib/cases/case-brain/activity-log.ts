/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PII_KEYS = new Set([
  "cpf",
  "cnpj",
  "email",
  "phone",
  "telefone",
  "document",
  "rawText",
  "text",
  "content",
]);

/**
 * Registra atividade no workspace (sem PII em metaJson — apenas ids e tipos).
 */
export async function recordCaseMutationActivity(args: {
  workspaceId: string;
  kind: string;
  title: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const safeMeta = scrubMeta(args.meta ?? {});
  await prisma.activity.create({
    data: {
      workspaceId: args.workspaceId,
      kind: args.kind,
      title: args.title.slice(0, 500),
      metaJson: Object.keys(safeMeta).length ? (safeMeta as Prisma.InputJsonValue) : undefined,
    },
  });
}

function scrubMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 200) {
      out[k] = `${v.slice(0, 80)}…`;
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrubMeta(v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out;
}
