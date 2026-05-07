import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let admin: ReturnType<typeof createClient> | null = null;

/**
 * Cliente Supabase com service_role (bypass de RLS) para operações server-side privilegiadas
 * como upload/download em Storage. Lança erro claro se a chave não estiver configurada.
 *
 * Usa o subconjunto granular `getSupabaseEnv()` — não exige envs de IA/Redis/Qdrant.
 */
export function createSupabaseAdminClient() {
  if (admin) return admin;
  const env = getSupabaseEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurado. Pegue em " +
        "Project Settings → API → service_role e adicione ao .env. " +
        "Necessário para upload/download via Storage admin client.",
    );
  }
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return admin;
}
