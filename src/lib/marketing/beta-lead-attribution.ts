import { z } from "zod";

const utmField = z.string().trim().max(200).optional().or(z.literal(""));

export const betaLeadAttributionSchema = z.object({
  utmSource: utmField,
  utmMedium: utmField,
  utmCampaign: utmField,
  utmContent: utmField,
  utmTerm: utmField,
  referrer: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type BetaLeadAttribution = z.infer<typeof betaLeadAttributionSchema>;

/** Lê UTM da query string no cliente (landing). */
export function readUtmFromSearchParams(params: URLSearchParams): BetaLeadAttribution {
  const pick = (key: string) => params.get(key)?.trim() ?? "";
  return {
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmContent: pick("utm_content"),
    utmTerm: pick("utm_term"),
    referrer: "",
  };
}

export function readReferrer(): string {
  if (typeof document === "undefined") return "";
  return document.referrer?.trim().slice(0, 2000) ?? "";
}

export function normalizeAttributionForDb(
  attr: BetaLeadAttribution,
  referrer?: string,
): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
} {
  const empty = (s?: string) => {
    const t = s?.trim();
    return t ? t.slice(0, 200) : null;
  };
  const ref = (referrer ?? attr.referrer)?.trim();
  return {
    utmSource: empty(attr.utmSource),
    utmMedium: empty(attr.utmMedium),
    utmCampaign: empty(attr.utmCampaign),
    utmContent: empty(attr.utmContent),
    utmTerm: empty(attr.utmTerm),
    referrer: ref ? ref.slice(0, 2000) : null,
  };
}
