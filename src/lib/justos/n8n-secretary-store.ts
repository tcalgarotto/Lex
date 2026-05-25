import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";
import {
  isPhoneAuthorizedForCase,
  resolveCaseJustosContacts,
  validateSecretaryPatch,
} from "./contact-access";
import type { N8nSecretaryPayload } from "./secretary-from-case";
import { extractN8nSecretaryFromCaseMetadata } from "./secretary-from-case";
import { normalizeJustosPhone, normalizeJustosPhoneList } from "./phone-normalize";
import { isJustosProActive, readJustosWorkspaceConfig } from "./workspace-config";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export type N8nSecretaryRecord = N8nSecretaryPayload & {
  updatedAt?: string;
  notificationLog?: Array<Record<string, unknown>>;
};

/** Propaga `lawyerWhatsApp` do workspace para todos os casos ativos (corrige cron por caso antigo). */
export async function syncWorkspaceLawyerWhatsAppToAllCases(
  workspaceId: string,
  lawyerWhatsApp: string[],
): Promise<string[]> {
  const cases = await prisma.case.findMany({
    where: { workspaceId, deletedAt: null, archivedAt: null },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  const synced: string[] = [];
  for (const c of cases) {
    await saveCaseN8nSecretary({
      workspaceId,
      caseId: c.id,
      patch: { lawyerWhatsApp },
    });
    synced.push(c.id);
  }
  return synced;
}

export async function saveCaseN8nSecretary(args: {
  workspaceId: string;
  caseId: string;
  patch: {
    clientWhatsApp?: string | null;
    lawyerWhatsApp?: string[] | string | null;
    preferences?: Record<string, unknown>;
  };
}): Promise<N8nSecretaryRecord> {
  const [row, ws] = await Promise.all([
    prisma.case.findFirst({
      where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
      select: { metadataJson: true },
    }),
    prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { onboardingJson: true },
    }),
  ]);
  if (!row) {
    throw Object.assign(new Error("Caso não encontrado"), { status: 404 });
  }

  const wsConfig = readJustosWorkspaceConfig(ws?.onboardingJson);
  const patchValidation = validateSecretaryPatch(args.patch, wsConfig);
  if (!patchValidation.ok) {
    throw Object.assign(new Error(patchValidation.error), { status: 403 });
  }

  const meta = asRecord(row.metadataJson);
  const prev = asRecord(meta["n8nSecretary"]);
  const lawyerWa =
    args.patch.lawyerWhatsApp !== undefined
      ? normalizeJustosPhoneList(args.patch.lawyerWhatsApp)
      : normalizeJustosPhoneList(prev["lawyerWhatsApp"]);

  const clientWa =
    args.patch.clientWhatsApp !== undefined
      ? args.patch.clientWhatsApp
        ? normalizeJustosPhone(args.patch.clientWhatsApp)
        : null
      : typeof prev["clientWhatsApp"] === "string"
        ? prev["clientWhatsApp"]
        : null;

  const secretary: N8nSecretaryRecord = {
    clientWhatsApp: clientWa,
    lawyerWhatsApp: lawyerWa,
    preferences: {
      ...asRecord(prev["preferences"]),
      ...(args.patch.preferences ?? {}),
    },
    updatedAt: new Date().toISOString(),
    notificationLog: Array.isArray(prev["notificationLog"])
      ? (prev["notificationLog"] as Array<Record<string, unknown>>)
      : [],
  };

  const metadataJson = mergeCaseMetadataJson(meta, { n8nSecretary: secretary });
  await prisma.case.update({
    where: { id: args.caseId },
    data: { metadataJson: metadataJson as Prisma.InputJsonValue },
  });

  return secretary;
}

export async function appendCaseNotificationLog(args: {
  workspaceId: string;
  caseId: string;
  event: string;
  channel: string;
  to: string;
  traceId: string;
}): Promise<void> {
  const row = await prisma.case.findFirst({
    where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
    select: { metadataJson: true },
  });
  if (!row) return;

  const meta = asRecord(row.metadataJson);
  const prev = asRecord(meta["n8nSecretary"]);
  const log = Array.isArray(prev["notificationLog"])
    ? [...(prev["notificationLog"] as Array<Record<string, unknown>>)]
    : [];

  log.unshift({
    at: new Date().toISOString(),
    event: args.event,
    channel: args.channel,
    to: args.to,
    traceId: args.traceId,
  });

  const secretary = {
    ...prev,
    notificationLog: log.slice(0, 50),
  };

  const metadataJson = mergeCaseMetadataJson(meta, { n8nSecretary: secretary });
  await prisma.case.update({
    where: { id: args.caseId },
    data: { metadataJson: metadataJson as Prisma.InputJsonValue },
  });
}

export type StalledCaseRow = {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  updatedAt: string;
  metadataJson: Record<string, unknown>;
  clientWhatsApp: string | null;
  lawyerWhatsApp: string[];
  allowedRecipients: string[];
};

export async function listStalledCasesForJustos(limit = 15): Promise<StalledCaseRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      workspaceId: string;
      title: string;
      status: string;
      updatedAt: Date;
      metadataJson: unknown;
      workspaceOnboardingJson: unknown;
    }>
  >`
    SELECT c.id, c."workspaceId", c.title, c.status, c."updatedAt", c."metadataJson",
           w."onboardingJson" AS "workspaceOnboardingJson"
    FROM "Case" c
    INNER JOIN "Workspace" w ON w.id = c."workspaceId"
    WHERE c."deletedAt" IS NULL
      AND c."archivedAt" IS NULL
      AND c."updatedAt" < NOW() - INTERVAL '6 hours'
      AND COALESCE((w."onboardingJson"->'justos'->>'enabled')::boolean, false) = true
      AND COALESCE((w."onboardingJson"->'justos'->>'proEnabled')::boolean, false) = true
      AND (
        jsonb_array_length(COALESCE(c."metadataJson"->'n8nSecretary'->'lawyerWhatsApp', '[]'::jsonb)) > 0
        OR jsonb_array_length(COALESCE(w."onboardingJson"->'justos'->'lawyerWhatsApp', '[]'::jsonb)) > 0
        OR (c."metadataJson"->'brain'->'proceduralReadiness'->>'status') = 'insuficiente'
      )
    ORDER BY c."updatedAt" ASC
    LIMIT ${Math.min(100, limit * 5)}
  `;

  const out: StalledCaseRow[] = [];
  for (const r of rows) {
    const wsConfig = readJustosWorkspaceConfig(r.workspaceOnboardingJson);
    if (!isJustosProActive(wsConfig)) continue;

    const caseSec = extractN8nSecretaryFromCaseMetadata(r.metadataJson);
    const contacts = resolveCaseJustosContacts(caseSec, wsConfig);
    if (contacts.lawyerWhatsApp.length === 0 || contacts.allowedRecipients.length === 0) continue;

    out.push({
      id: r.id,
      workspaceId: r.workspaceId,
      title: r.title,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      metadataJson: asRecord(r.metadataJson),
      clientWhatsApp: contacts.clientWhatsApp,
      lawyerWhatsApp: contacts.lawyerWhatsApp,
      allowedRecipients: contacts.allowedRecipients,
    });
    if (out.length >= limit) break;
  }

  return out;
}

export async function assertNotificationRecipientAuthorized(args: {
  workspaceId: string;
  caseId: string;
  to: string;
}): Promise<void> {
  const [row, ws] = await Promise.all([
    prisma.case.findFirst({
      where: { id: args.caseId, workspaceId: args.workspaceId, deletedAt: null },
      select: { metadataJson: true },
    }),
    prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { onboardingJson: true },
    }),
  ]);
  if (!row) {
    throw Object.assign(new Error("Caso não encontrado"), { status: 404 });
  }

  const contacts = resolveCaseJustosContacts(
    extractN8nSecretaryFromCaseMetadata(row.metadataJson),
    readJustosWorkspaceConfig(ws?.onboardingJson),
  );
  if (!isPhoneAuthorizedForCase(args.to, contacts)) {
    throw Object.assign(new Error("Destinatário não autorizado para este caso"), { status: 403 });
  }
}
