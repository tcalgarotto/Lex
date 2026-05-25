import type { NextRequest } from "next/server";
import { parseAllowedDevOrigins } from "../../../config/allowed-dev-origins";

/** Hosts que representam esta instância do app na request atual. */
export function requestAppHosts(request: NextRequest): string[] {
  const url = new URL(request.url);
  const hosts = [url.host];
  const headerHost = request.headers.get("host");
  if (headerHost && !hosts.includes(headerHost)) hosts.push(headerHost);
  return hosts;
}

/**
 * CSRF guard: mutação do browser é permitida se Origin bate com Host da request
 * ou, em dev, com `ALLOWED_DEV_ORIGINS` (acesso LAN — ver docs/DEV_LAN_ACCESS.md).
 */
export function isAllowedBrowserMutationOrigin(request: NextRequest, origin: string): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  if (requestAppHosts(request).includes(originHost)) return true;

  if (process.env.NODE_ENV === "production") return false;

  const allowedHosts = parseAllowedDevOrigins();
  if (!allowedHosts?.length) return false;

  const originUrl = new URL(origin);
  if (!allowedHosts.includes(originUrl.hostname)) return false;

  const originPort = originUrl.port || "3000";
  return requestAppHosts(request).some((h) => {
    const [, port = "3000"] = h.split(":");
    return port === originPort;
  });
}
