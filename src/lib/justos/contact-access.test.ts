import { describe, expect, it } from "vitest";
import {
  isPhoneAuthorizedForCase,
  resolveCaseJustosContacts,
  validateSecretaryPatch,
} from "./contact-access";

describe("resolveCaseJustosContacts", () => {
  it("usa advogados do caso com fallback do workspace", () => {
    const ws = { enabled: true, proEnabled: true, lawyerWhatsApp: ["+5547991111111"] };
    const caseOnly = resolveCaseJustosContacts(
      { lawyerWhatsApp: ["+5547992222222"], clientWhatsApp: "+5547988888888" },
      ws,
    );
    expect(caseOnly.lawyerWhatsApp).toEqual(["+5547992222222"]);
    expect(caseOnly.allowedRecipients).toContain("+5547988888888");

    const fallback = resolveCaseJustosContacts(undefined, ws);
    expect(fallback.lawyerWhatsApp).toEqual(["+5547991111111"]);
  });

  it("aplica allowlist do workspace nos destinatários", () => {
    const ws = {
      enabled: true,
      proEnabled: true,
      allowedNumbers: ["+5547991111111"],
      lawyerWhatsApp: ["+5547991111111", "+5547992222222"],
    };
    const contacts = resolveCaseJustosContacts(
      { clientWhatsApp: "+5547988888888", lawyerWhatsApp: ["+5547991111111"] },
      ws,
    );
    expect(contacts.allowedRecipients).toEqual(["+5547991111111"]);
    expect(isPhoneAuthorizedForCase("+5547988888888", contacts)).toBe(false);
    expect(isPhoneAuthorizedForCase("+5547991111111", contacts)).toBe(true);
  });
});

describe("validateSecretaryPatch", () => {
  it("rejeita número fora da allowlist", () => {
    const ws = {
      enabled: true,
      proEnabled: true,
      allowedNumbers: ["+5547991111111"],
    };
    const r = validateSecretaryPatch({ clientWhatsApp: "+5547988888888" }, ws);
    expect(r.ok).toBe(false);
  });

  it("permite quando não há allowlist", () => {
    const ws = { enabled: true, proEnabled: true };
    const r = validateSecretaryPatch({ clientWhatsApp: "+5547988888888" }, ws);
    expect(r.ok).toBe(true);
  });
});
