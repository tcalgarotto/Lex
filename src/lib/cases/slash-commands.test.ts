import { describe, expect, it } from "vitest";
import { parseSlashCommands } from "./slash-commands";

describe("parseSlashCommands", () => {
  it("extrai comandos com e sem barra, com separadores variados", () => {
    const t = `
/autora: natalia valente
reu - prefeitura de camboriu
fato: nao consigo vaga em creche para minha filha
/pedido: que a prefeitura consiga vaga em creche
/urgencia: trabalho 12 horas por dia
`;
    const r = parseSlashCommands(t);
    expect(r.commands.map((c) => c.name)).toEqual([
      "autora",
      "reu",
      "fato",
      "pedido",
      "urgencia",
    ]);
    expect(r.commands[0]?.value.toLowerCase()).toContain("natalia");
    expect(r.cleanedText).not.toContain("/autora");
    expect(r.cleanedText).not.toContain("fato:");
  });

  it("aceita 'réu' com acento e múltiplos comandos na mesma linha", () => {
    const t = "/autora Maria /réu Município de X /fato sem vaga";
    const r = parseSlashCommands(t);
    expect(r.commands.find((c) => c.name === "réu")?.value).toContain("Município");
    expect(r.commands.filter((c) => c.name === "autora").length).toBe(1);
    expect(r.commands.filter((c) => c.name === "fato").length).toBe(1);
  });

  it("mantém linha narrativa quando comando aparece inline (não no início)", () => {
    const t = "Cliente relata que /fato houve negativa ontem.";
    const r = parseSlashCommands(t);
    expect(r.cleanedText).toContain("Cliente relata");
    expect(r.commands.some((c) => c.name === "fato")).toBe(true);
  });

  it("ignora comandos sem valor", () => {
    const t = "/fato:\n/pedido -   \nTexto normal.";
    const r = parseSlashCommands(t);
    expect(r.commands.length).toBe(0);
    expect(r.cleanedText).toContain("Texto normal.");
  });
});

