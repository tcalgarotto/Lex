/**
 * GET   /api/notifications        — lista notificações do usuário no workspace.
 * PATCH /api/notifications        — { action: "markAllRead" }.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationKind, NotificationStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  countUnread,
  listNotifications,
  markAllAsRead,
} from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  action: z.literal("markAllRead"),
});

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
  const { workspaceId, user } = await getWorkspaceContext();
  const url = new URL(req.url);
  const status = parseEnumList(url.searchParams.get("status"), Object.values(NotificationStatus));
  const kind = parseEnumList(url.searchParams.get("kind"), Object.values(NotificationKind));
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get("take") ?? "50")));
  const args: Parameters<typeof listNotifications>[0] = {
    workspaceId,
    userId: user.id,
    take,
  };
  if (status) args.status = status;
  if (kind) args.kind = kind;
  const [items, unread] = await Promise.all([
    listNotifications(args),
    countUnread({ workspaceId, userId: user.id }),
  ]);
  return NextResponse.json({ notifications: items, unread });
}

export async function PATCH(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  if (body.action === "markAllRead") {
    const r = await markAllAsRead({ workspaceId, userId: user.id });
    return NextResponse.json({ ok: true, updated: r.count });
  }
  return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
}
