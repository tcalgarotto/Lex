import type { LexJustosEventName } from "./types";
import { emitLexJustosEvent } from "./emit-event";
import type { N8nSecretaryPayload } from "./secretary-from-case";
import { extractN8nSecretaryFromCaseMetadata } from "./secretary-from-case";
import { resolveCaseJustosContacts } from "./contact-access";
import { readJustosWorkspaceConfig } from "./workspace-config";
import { prisma } from "@/lib/prisma";

/**
 * Carrega caso + workspace e dispara webhook n8n (fire-and-forget).
 */
export async function emitLexJustosEventForCase(args: {
  event: LexJustosEventName;
  workspaceId: string;
  caseId: string;
  meta?: Record<string, unknown>;
  title?: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const [ws, c] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { onboardingJson: true },
    }),
    prisma.case.findFirst({
      where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
      select: { title: true, metadataJson: true },
    }),
  ]);

  if (!c) {
    return { sent: false, skipped: "case_not_found" };
  }

  const wsConfig = readJustosWorkspaceConfig(ws?.onboardingJson);
  const caseSec = extractN8nSecretaryFromCaseMetadata(c.metadataJson);
  const contacts = resolveCaseJustosContacts(caseSec, wsConfig);
  const secretary = mergeSecretaryWithWorkspace(caseSec, wsConfig);

  return emitLexJustosEvent({
    event: args.event,
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    workspaceOnboardingJson: ws?.onboardingJson,
    title: args.title ?? c.title,
    secretary,
    allowedRecipients: contacts.allowedRecipients,
    extras: args.meta,
    meta: args.meta,
  });
}

/** Não bloqueia a request HTTP / worker. */
export function fireLexJustosEventForCase(
  args: Parameters<typeof emitLexJustosEventForCase>[0],
): void {
  void emitLexJustosEventForCase(args).catch(() => {
    /* webhook best-effort */
  });
}

function mergeSecretaryWithWorkspace(
  caseSec: N8nSecretaryPayload | undefined,
  wsConfig: ReturnType<typeof readJustosWorkspaceConfig>,
): N8nSecretaryPayload | undefined {
  const contacts = resolveCaseJustosContacts(caseSec, wsConfig);
  if (contacts.allowedRecipients.length === 0) return undefined;

  return {
    clientWhatsApp: contacts.clientWhatsApp,
    lawyerWhatsApp: contacts.lawyerWhatsApp,
    preferences: caseSec?.preferences ?? {},
  };
}
