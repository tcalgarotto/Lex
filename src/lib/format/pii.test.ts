import { describe, expect, it } from "vitest";
import {
  maskCnpj,
  maskCpf,
  maskDocument,
  maskEmail,
  maskPhone,
  maybeMaskDocument,
  maybeMaskEmail,
  maybeMaskPhone,
} from "./pii";

describe("maskCpf", () => {
  it("mascara CPF com pontuação", () => {
    expect(maskCpf("123.456.789-09")).toBe("***.456.789-**");
  });
  it("mascara CPF apenas com dígitos", () => {
    expect(maskCpf("12345678909")).toBe("***.456.789-**");
  });
  it("mascara defensivamente quando length != 11", () => {
    expect(maskCpf("123")).toBe("***");
  });
  it("retorna placeholder para vazio/null", () => {
    expect(maskCpf(null)).toBe("—");
    expect(maskCpf("")).toBe("—");
  });
});

describe("maskCnpj", () => {
  it("mascara CNPJ com pontuação", () => {
    expect(maskCnpj("12.345.678/0001-99")).toBe("**.345.678/0001-**");
  });
  it("mascara CNPJ apenas com dígitos", () => {
    expect(maskCnpj("12345678000199")).toBe("**.345.678/0001-**");
  });
});

describe("maskDocument", () => {
  it("detecta CPF e CNPJ pelo número de dígitos", () => {
    expect(maskDocument("12345678909")).toBe("***.456.789-**");
    expect(maskDocument("12345678000199")).toBe("**.345.678/0001-**");
  });
});

describe("maskPhone", () => {
  it("mantém DDD e os 4 últimos dígitos (celular 11 dígitos)", () => {
    expect(maskPhone("(47) 99876-5432")).toBe("(47) ****-5432");
    expect(maskPhone("47998765432")).toBe("(47) ****-5432");
  });
  it("mantém DDD e 4 últimos para fixo (10 dígitos)", () => {
    expect(maskPhone("1132458787")).toBe("(11) ****-8787");
  });
  it("mascara defensivamente para length inválido", () => {
    expect(maskPhone("123")).toBe("***");
  });
});

describe("maskEmail", () => {
  it("preserva primeiro/último char do localpart e domínio", () => {
    expect(maskEmail("ana.paula@gmail.com")).toBe("a***a@gmail.com");
  });
  it("trata localpart curto", () => {
    expect(maskEmail("ab@x.io")).toBe("a*@x.io");
  });
  it("retorna placeholder/asteriscos para inválido", () => {
    expect(maskEmail(null)).toBe("—");
    expect(maskEmail("semarroba")).toBe("*********");
  });
});

describe("maybeMask*", () => {
  it("respeita showFull", () => {
    expect(maybeMaskDocument("12345678909", true)).toBe("12345678909");
    expect(maybeMaskDocument("12345678909", false)).toBe("***.456.789-**");
    expect(maybeMaskPhone("47998765432", true)).toBe("47998765432");
    expect(maybeMaskEmail("a@b.io", true)).toBe("a@b.io");
  });
});
