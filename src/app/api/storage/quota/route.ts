import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getWorkspaceStorageSummary } from "@/lib/storage/storage-quota";

export const runtime = "nodejs";

/**
 * GET /api/storage/quota — uso e limites da nuvem de documentos do workspace ativo.
 */
export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const s = await getWorkspaceStorageSummary(workspaceId);
  return NextResponse.json({
    usedBytes: Number(s.usedBytes),
    quotaBytes: Number(s.quotaBytes),
    remainingBytes: Number(s.remainingBytes),
    percentUsed: s.percentUsed,
    maxFileSizeBytes: s.maxFileSizeBytes,
    planName: s.planName,
  });
}
