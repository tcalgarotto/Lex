import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getProcessAnalytics } from "@/lib/legal-processes/process-analytics";

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  return NextResponse.json(await getProcessAnalytics(workspaceId));
}
