import { NextResponse } from "next/server";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import {
  createOfficialCommunication,
  normalizeOfficialCommunicationSource,
  normalizeOfficialCommunicationType,
  parseOfficialCommunicationDate,
} from "@/lib/official-communications/service";

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContextWithRole();
  const form = await req.formData();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const communication = await createOfficialCommunication({
    workspaceId,
    createdByUserId: user.id,
    legalProcessId: String(form.get("legalProcessId") ?? "") || null,
    processId: String(form.get("processId") ?? "") || null,
    caseId: String(form.get("caseId") ?? "") || null,
    documentId: String(form.get("documentId") ?? "") || null,
    source: normalizeOfficialCommunicationSource(form.get("source")),
    communicationType: normalizeOfficialCommunicationType(form.get("communicationType")),
    receivedAt: parseOfficialCommunicationDate(form.get("receivedAt")),
    availableAt: parseOfficialCommunicationDate(form.get("availableAt")),
    readAt: parseOfficialCommunicationDate(form.get("readAt")),
    dueReviewAt: parseOfficialCommunicationDate(form.get("dueReviewAt")),
    title,
    description: String(form.get("description") ?? "").trim() || null,
    rawText: String(form.get("rawText") ?? "").trim() || null,
  });

  return NextResponse.json({ id: communication.id, status: communication.status });
}
