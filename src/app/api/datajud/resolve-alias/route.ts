import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { resolveDataJudAlias } from "@/lib/datajud/resolve-datajud-alias";
import { getEnv } from "@/lib/env";

const Body = z.object({
  cnj: z.string().min(1).optional(),
  tribunalAcronym: z.string().min(2).max(20).optional(),
});

export async function POST(req: Request) {
  await getWorkspaceContext();
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const env = getEnv();
  const resolution = resolveDataJudAlias({
    cnj: body.data.cnj,
    tribunalAcronym: body.data.tribunalAcronym,
    fallbackAlias: env.DATAJUD_DEFAULT_ALIAS,
  });

  if (!resolution.ok) {
    return NextResponse.json({
      resolved: false,
      reason: resolution.reason,
      cnj: resolution.cnj
        ? {
            formatted: resolution.cnj.formatted,
            isValid: resolution.cnj.isValid,
            branch: resolution.cnj.branch,
          }
        : null,
      message: resolution.reason === "invalid_cnj" ? "CNJ inválido" : "Selecione o tribunal",
    });
  }

  return NextResponse.json({
    resolved: true,
    source: resolution.source,
    cnj: {
      formatted: resolution.cnj.formatted,
      isValid: resolution.cnj.isValid,
      branch: resolution.cnj.branch,
    },
    tribunal: {
      acronym: resolution.tribunalAcronym,
      label: resolution.tribunalEntry.label,
      uf: resolution.tribunalEntry.uf ?? null,
    },
  });
}
