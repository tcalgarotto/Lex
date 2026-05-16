import { createHash } from "node:crypto";
import { z } from "zod";
import { betaLeadAttributionSchema } from "@/lib/marketing/beta-lead-attribution";

export const BETA_TEAM_SIZE_OPTIONS = [
  { value: "1", label: "Só eu" },
  { value: "2-5", label: "2 a 5 pessoas" },
  { value: "6-15", label: "6 a 15 pessoas" },
  { value: "16-50", label: "16 a 50 pessoas" },
  { value: "50+", label: "Mais de 50 pessoas" },
] as const;

export const betaLeadBodySchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome").max(120),
    email: z.string().trim().email("E-mail inválido").max(200),
    company: z.string().trim().min(2, "Informe o escritório ou empresa").max(200),
    role: z.string().trim().max(120).optional().or(z.literal("")),
    teamSize: z.enum(["1", "2-5", "6-15", "16-50", "50+"]),
    mainPain: z.string().trim().max(2000).optional().or(z.literal("")),
    intent: z.enum(["beta", "demo"]).default("beta"),
    contactConsent: z.boolean().refine((v) => v === true, {
      message: "É necessário autorizar o contato",
    }),
    /** Honeypot — deve permanecer vazio */
    companyWebsite: z.string().optional().default(""),
  })
  .merge(betaLeadAttributionSchema);

export type BetaLeadBody = z.infer<typeof betaLeadBodySchema>;

export function hashLeadIp(ip: string): string {
  const salt = process.env["BETA_LEAD_IP_SALT"] ?? process.env["AUTH_SECRET"] ?? "lex-beta-lead";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export const BETA_LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  DISCARDED: "Descartado",
};
