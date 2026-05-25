/** Monta payload `secretary` para o webhook n8n a partir do caso. */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

export type N8nSecretaryPayload = {
  clientWhatsApp?: string | null;
  lawyerWhatsApp?: string[];
  preferences?: Record<string, unknown>;
};

export function extractN8nSecretaryFromCaseMetadata(
  metadataJson: unknown,
): N8nSecretaryPayload | undefined {
  const meta = asRecord(metadataJson);
  const stored = asRecord(meta["n8nSecretary"]);
  if (Object.keys(stored).length > 0) {
    const lawyers = stored["lawyerWhatsApp"];
    return {
      clientWhatsApp:
        typeof stored["clientWhatsApp"] === "string" ? stored["clientWhatsApp"] : null,
      lawyerWhatsApp: Array.isArray(lawyers)
        ? lawyers.filter((n): n is string => typeof n === "string")
        : undefined,
      preferences: asRecord(stored["preferences"]),
    };
  }

  const form = asRecord(meta["intakeForm"]);
  if (!Object.keys(form).length) return undefined;

  const clientPerson = asRecord(form["clientPerson"]);
  const attend = asRecord(form["attend"]);
  const clientWa = normalizePhone(clientPerson["phone"]);
  const lawyerWa = normalizePhone(attend["responsibleLawyerPhone"] ?? attend["lawyerPhone"]);

  if (!clientWa && !lawyerWa) return undefined;

  return {
    clientWhatsApp: clientWa,
    lawyerWhatsApp: lawyerWa ? [lawyerWa] : [],
    preferences: {},
  };
}
