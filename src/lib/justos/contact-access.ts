/**
 * Controle de acesso JustOS: caso ↔ workspace ↔ números autorizados (WhatsApp).
 */

import type { JustosWorkspaceConfig } from "./types";
import type { N8nSecretaryPayload } from "./secretary-from-case";
import { normalizeJustosPhone, normalizeJustosPhoneList } from "./phone-normalize";
import { readJustosWorkspaceConfig } from "./workspace-config";

export type CaseJustosContacts = {
  clientWhatsApp: string | null;
  lawyerWhatsApp: string[];
  /** Números que podem receber WA deste caso (E.164, deduplicados). */
  allowedRecipients: string[];
};

function phoneKey(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function resolveCaseJustosContacts(
  caseSecretary: N8nSecretaryPayload | undefined,
  wsConfig: JustosWorkspaceConfig,
): CaseJustosContacts {
  const caseLawyers = normalizeJustosPhoneList(caseSecretary?.lawyerWhatsApp ?? []);
  const wsLawyers = normalizeJustosPhoneList(wsConfig.lawyerWhatsApp ?? []);
  const lawyers = caseLawyers.length > 0 ? caseLawyers : wsLawyers;

  const client =
    caseSecretary?.clientWhatsApp != null
      ? normalizeJustosPhone(caseSecretary.clientWhatsApp)
      : null;

  let recipients: string[] = [...lawyers];
  if (client) recipients.push(client);

  const wsAllow = normalizeJustosPhoneList(wsConfig.allowedNumbers ?? []);
  if (wsAllow.length > 0) {
    const allowSet = new Set(wsAllow.map(phoneKey));
    recipients = recipients.filter((p) => allowSet.has(phoneKey(p)));
  }

  const seen = new Set<string>();
  recipients = recipients.filter((p) => {
    const k = phoneKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    clientWhatsApp: client,
    lawyerWhatsApp: lawyers,
    allowedRecipients: recipients,
  };
}

export function isPhoneAuthorizedForCase(phone: string, contacts: CaseJustosContacts): boolean {
  const normalized = normalizeJustosPhone(phone);
  if (!normalized) return false;
  const key = phoneKey(normalized);
  return contacts.allowedRecipients.some((p) => phoneKey(p) === key);
}

export function validateSecretaryPatch(
  patch: {
    clientWhatsApp?: string | null;
    lawyerWhatsApp?: string[] | string | null;
  },
  wsConfig: JustosWorkspaceConfig,
): { ok: true } | { ok: false; error: string } {
  const wsAllow = normalizeJustosPhoneList(wsConfig.allowedNumbers ?? []);
  if (wsAllow.length === 0) return { ok: true };

  const allowSet = new Set(wsAllow.map(phoneKey));
  const toCheck: string[] = [];

  if (patch.clientWhatsApp) {
    const n = normalizeJustosPhone(patch.clientWhatsApp);
    if (n) toCheck.push(n);
  }
  if (patch.lawyerWhatsApp !== undefined) {
    toCheck.push(...normalizeJustosPhoneList(patch.lawyerWhatsApp));
  }

  for (const p of toCheck) {
    if (!allowSet.has(phoneKey(p))) {
      return {
        ok: false,
        error: "Número não está na lista autorizada do escritório (JustOS).",
      };
    }
  }
  return { ok: true };
}

export function isJustosAutomationAllowed(workspaceOnboardingJson: unknown): boolean {
  const config = readJustosWorkspaceConfig(workspaceOnboardingJson);
  if (config.enabled) return true;
  return process.env["JUSTOS_DEV_EMIT"] === "true";
}
