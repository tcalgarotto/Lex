import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncAuthUserToDatabase } from "@/lib/auth/sync-user";
import { rateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getRequestIp(request.headers);
  const rl = await rateLimit({
    key: `auth:sync:${ip}`,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: rateLimitHeaders(rl) },
    );
  }
  const ctx = await syncAuthUserToDatabase(user);
  return NextResponse.json(ctx, { headers: rateLimitHeaders(rl) });
}
