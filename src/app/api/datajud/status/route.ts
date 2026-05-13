import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createDataJudClient, getDataJudProviderMode } from "@/lib/datajud/datajud-client";
import { getAliasEntry } from "@/lib/datajud/datajud-aliases";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await getWorkspaceContext();
  const env = getEnv();
  const mode = getDataJudProviderMode();
  const alias = env.DATAJUD_DEFAULT_ALIAS || "api_publica_tjrs";
  const entry = getAliasEntry(alias);

  if (mode === "off") {
    return NextResponse.json({
      status: "desativado",
      active: false,
      tribunal: entry?.label ?? "Tribunal padrão",
    });
  }

  try {
    const health = await createDataJudClient(alias).health();
    return NextResponse.json({
      status: health.ok ? "ativo" : "pendente",
      active: health.ok,
      tribunal: entry?.label ?? "Tribunal padrão",
      tookMs: health.tookMs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "pendente",
        active: false,
        tribunal: entry?.label ?? "Tribunal padrão",
        message: error instanceof Error ? error.message : "DataJud indisponível",
      },
      { status: 503 },
    );
  }
}
