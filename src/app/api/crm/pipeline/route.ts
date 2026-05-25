import { NextResponse } from "next/server";
import { getCrmApiContext, getCrmPipelineBoard, handleCrmRouteError } from "@/lib/justos/crm";

export async function GET() {
  try {
    const { workspaceId } = await getCrmApiContext();
    const board = await getCrmPipelineBoard(workspaceId);
    return NextResponse.json(board);
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
