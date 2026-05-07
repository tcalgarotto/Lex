import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness probe: o processo bootou. Não toca dependências. */
export function GET() {
  return NextResponse.json({ ready: true, timestamp: new Date().toISOString() });
}
