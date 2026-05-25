import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

export function getSupabaseProjectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split(".")[0] ?? "project";
}

/** Injeta sessão Supabase no contexto Playwright (evita flaky no form React). */
export async function injectSupabaseSession(
  context: BrowserContext,
  opts: { email: string; password: string; baseURL: string },
): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios.");
  }

  const client = createClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
  });
  if (error || !data.session) {
    throw new Error(error?.message ?? "Sessão Supabase vazia após signInWithPassword.");
  }

  const session = data.session;
  const ref = getSupabaseProjectRef(supabaseUrl);
  const cookieName = `sb-${ref}-auth-token`;
  const host = new URL(opts.baseURL).hostname;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });

  await context.addCookies([
    {
      name: cookieName,
      value: payload,
      domain: host,
      path: "/",
      expires: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: opts.baseURL.startsWith("https"),
      sameSite: "Lax",
    },
  ]);
}
