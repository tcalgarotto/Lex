/**
 * GET /api/alerts — lista alertas (timeline jurídica viva) do workspace.
 *
 * Auth: requer sessão + workspace ativo.
 * Filtros: status, severity, caseId.
 */

import { NextResponse } from "next/server";
import { CaseAlertSeverity, CaseAlertStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { listAlerts } from "@/lib/alerts/repository";

export const dynamic = "force-dynamic";

function parseEnumList<T extends string>(
  value: string | null,
  allowed: ReadonlyArray<T>,
): T[] | undefined {
  if (!value) return undefined;
  const out = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is T => (allowed as ReadonlyArray<string>).includes(s));
  return out.length ? out : undefined;
}

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const statusList = parseEnumList(
    url.searchParams.get("status"),
    Object.values(CaseAlertStatus),
  );
  const severityList = parseEnumList(
    url.searchParams.get("severity"),
    Object.values(CaseAlertSeverity),
  );
  const caseId = url.searchParams.get("caseId") ?? undefined;
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get("take") ?? "50")));
  const args: Parameters<typeof listAlerts>[0] = { workspaceId, take };
  if (statusList) args.status = statusList;
  if (severityList) args.severity = severityList;
  if (caseId) args.caseId = caseId;
  const alerts = await listAlerts(args);
  return NextResponse.json({ alerts });
}
