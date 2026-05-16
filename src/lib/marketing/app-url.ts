/**
 * URL pública do app para metadata, OG e links em e-mails.
 * Em produção na Vercel, prefira NEXT_PUBLIC_APP_URL explícita.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // fall through
    }
  }

  const vercel = process.env["VERCEL_URL"]?.trim();
  if (vercel) {
    const host = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    try {
      return new URL(host).origin;
    } catch {
      // fall through
    }
  }

  return "http://localhost:3000";
}

/** Evita canonical/OG com localhost em build de produção sem env configurada. */
export function isProductionAppUrlMisconfigured(): boolean {
  if (process.env["NODE_ENV"] !== "production") return false;
  const url = getPublicAppUrl();
  return /localhost|127\.0\.0\.1/i.test(url);
}
