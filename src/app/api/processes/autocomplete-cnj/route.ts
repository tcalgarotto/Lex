import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createDataJudClient } from "@/lib/datajud/datajud-client";
import { resolveDataJudAlias } from "@/lib/datajud/resolve-datajud-alias";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  q: z.string().min(3).max(40),
  tribunalAcronym: z.string().min(2).max(20).optional(),
});

function digits(value: string) {
  return value.replace(/\D+/g, "");
}

export async function POST(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const qDigits = digits(parsed.data.q);
  const local = await prisma.legalProcess.findMany({
    where: {
      workspaceId,
      OR: [
        { cnj: { startsWith: qDigits } },
        { cnjFormatted: { contains: parsed.data.q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      processId: true,
      cnjFormatted: true,
      tribunalAcronym: true,
      classeNome: true,
      orgaoJulgadorNome: true,
    },
  });

  if (qDigits.length < 7) return NextResponse.json({ results: local, remoteChecked: false });

  const env = getEnv();
  const resolution = resolveDataJudAlias({
    cnj: qDigits.length === 20 ? qDigits : undefined,
    tribunalAcronym: parsed.data.tribunalAcronym,
    fallbackAlias: env.DATAJUD_DEFAULT_ALIAS,
  });
  if (!resolution.ok) return NextResponse.json({ results: local, remoteChecked: false });

  try {
    const hits = await createDataJudClient(resolution.alias).autocomplete(qDigits, 8);
    const remote = hits.map((hit) => {
      const src = hit._source ?? {};
      return {
        id: hit._id ?? String(src["numeroProcesso"] ?? ""),
        processId: null,
        cnjFormatted: String(src["numeroProcesso"] ?? ""),
        tribunalAcronym: String(src["tribunal"] ?? resolution.tribunalAcronym),
        classeNome:
          src["classe"] && typeof src["classe"] === "object"
            ? String((src["classe"] as Record<string, unknown>)["nome"] ?? "")
            : null,
        orgaoJulgadorNome:
          src["orgaoJulgador"] && typeof src["orgaoJulgador"] === "object"
            ? String((src["orgaoJulgador"] as Record<string, unknown>)["nome"] ?? "")
            : null,
        remote: true,
      };
    });
    return NextResponse.json({ results: [...local, ...remote], remoteChecked: true });
  } catch {
    return NextResponse.json({ results: local, remoteChecked: false });
  }
}
