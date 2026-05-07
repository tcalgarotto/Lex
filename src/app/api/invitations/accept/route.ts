import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireAuthUser } from "@/lib/auth/session";
import { acceptInvitation } from "@/lib/auth/invitations";
import { syncAuthUserToDatabase } from "@/lib/auth/sync-user";
import { WORKSPACE_COOKIE } from "@/lib/constants";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10) });

export async function POST(req: Request) {
  const user = await requireAuthUser();
  const rl = await rateLimit({
    key: `invite-accept:${user.id}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
  }

  // Garante que o User row exista (caso seja primeira interação após signup OAuth)
  await syncAuthUserToDatabase(user);

  try {
    const result = await acceptInvitation({
      token: parsed.data.token,
      userId: user.id,
      userEmail: user.email ?? "",
    });
    // Define o workspace recém-aceito como ativo
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, result.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao aceitar convite" },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
}
