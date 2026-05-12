import { describe, expect, it } from "vitest";
import {
  maskCnjInput,
  maskCpfInput,
  maskCnpjInput,
  maskPhoneBrInput,
  maskCepInput,
  maskDateBrInput,
  parseBrDateToIso,
  formatIsoToBrDate,
  maskCurrencyBrlInput,
  parseCurrencyBrlDigits,
} from "@/lib/forms/legal-input-masks";

describe("legal-input-masks", () => {
  it("maskCnjInput formata até 20 dígitos", () => {
    expect(maskCnjInput("12345678901234567890")).toBe("1234567-89.0123.4.56.7890");
    expect(maskCnjInput("1234567")).toBe("1234567");
  });

  it("maskCpfInput aplica padrão BR", () => {
    expect(maskCpfInput("52998224725")).toBe("529.982.247-25");
  });

  it("maskCnpjInput aplica padrão BR", () => {
    expect(maskCnpjInput("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("maskPhoneBrInput celular e fixo", () => {
    expect(maskPhoneBrInput("11999998888")).toBe("(11) 99999-8888");
    expect(maskPhoneBrInput("1133334444")).toBe("(11) 3333-4444");
  });

  it("maskCepInput", () => {
    expect(maskCepInput("01310100")).toBe("01310-100");
  });

  it("maskDateBrInput", () => {
    expect(maskDateBrInput("04082026")).toBe("04/08/2026");
  });

  it("parseBrDateToIso rejeita ano absurdo e aceita válido", () => {
    expect(parseBrDateToIso("04/08/0001")).toBe("");
    expect(parseBrDateToIso("04/08/2026")).toBe("2026-08-04");
  });

  it("formatIsoToBrDate", () => {
    expect(formatIsoToBrDate("2026-05-12")).toBe("12/05/2026");
  });

  it("maskCurrencyBrlInput", () => {
    expect(maskCurrencyBrlInput("500000")).toBe("R$ 5.000,00");
  });

  it("parseCurrencyBrlDigits", () => {
    expect(parseCurrencyBrlDigits("R$ 5.000,00")).toBe(500000n);
  });
});
