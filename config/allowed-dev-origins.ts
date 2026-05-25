/**
 * Origens extras para `next dev` (allowedDevOrigins).
 * Só IPs privados / localhost — nunca entra no build de produção.
 */

const PRIVATE_IPV4 =
  /^(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|127\.0\.0\.1)$/;

/** Wildcards permitidos pelo Next (ex.: *.minha-rede.local), não `*` global. */
const SAFE_HOST_WILDCARD = /^\*\.[a-z0-9][a-z0-9.-]*$/i;

function isAllowedDevHost(host: string): boolean {
  if (!host || host.includes("/") || host.includes(":")) return false;
  if (host === "*" || host === "0.0.0.0") return false;
  if (host === "localhost") return true;
  if (PRIVATE_IPV4.test(host)) return true;
  if (SAFE_HOST_WILDCARD.test(host)) return true;
  return false;
}

/**
 * Lê `ALLOWED_DEV_ORIGINS` (vírgula, host sem porta).
 * Retorna `undefined` em produção ou se vazio/inválido.
 */
export function parseAllowedDevOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] | undefined {
  if (env.NODE_ENV === "production") return undefined;

  const out: string[] = [];
  const raw = env["ALLOWED_DEV_ORIGINS"]?.trim();
  if (raw) {
    for (const part of raw.split(",")) {
      const host = part.trim();
      if (!host) continue;
      if (isAllowedDevHost(host)) {
        if (!out.includes(host)) out.push(host);
      } else {
        console.warn(
          `[next.config] ALLOWED_DEV_ORIGINS ignorado (use IP privado, localhost ou *.dominio.local): ${host}`,
        );
      }
    }
  }

  for (const host of ["127.0.0.1", "localhost"]) {
    if (!out.includes(host)) out.push(host);
  }

  return out;
}

/** URL base sugerida para OAuth/callback na LAN (com porta). */
export function lanAppOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const hosts = parseAllowedDevOrigins(env);
  const first = hosts?.[0];
  if (!first) return null;
  const port = env["PORT"]?.trim() || "3000";
  return `http://${first}:${port}`;
}
