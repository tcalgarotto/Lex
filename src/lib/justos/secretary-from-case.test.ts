import { describe, expect, it } from "vitest";
import { extractN8nSecretaryFromCaseMetadata } from "./secretary-from-case";

describe("extractN8nSecretaryFromCaseMetadata", () => {
  it("usa n8nSecretary quando presente", () => {
    const s = extractN8nSecretaryFromCaseMetadata({
      n8nSecretary: {
        clientWhatsApp: "+5511999999999",
        lawyerWhatsApp: ["+5511888888888"],
      },
    });
    expect(s?.clientWhatsApp).toBe("+5511999999999");
    expect(s?.lawyerWhatsApp).toEqual(["+5511888888888"]);
  });

  it("deriva telefones da entrevista fundamental", () => {
    const s = extractN8nSecretaryFromCaseMetadata({
      intakeForm: {
        clientPerson: { phone: "(11) 99999-9999" },
        attend: { responsibleLawyerPhone: "11988887777" },
      },
    });
    expect(s?.clientWhatsApp).toMatch(/^\+55/);
    expect(s?.lawyerWhatsApp?.[0]).toMatch(/^\+55/);
  });
});
