export type SlashCommandName =
  | "autora"
  | "autor"
  | "reu"
  | "réu"
  | "fato"
  | "pedido"
  | "urgencia"
  | "documento"
  | "risco"
  | "observacao"
  | "prazo"
  | "valor";

export type ParsedSlashCommand = {
  name: SlashCommandName;
  /** Valor "cru" já trimado. */
  value: string;
  /** Trecho original que gerou a extração (auditável). */
  sourceText: string;
};

export type ParseSlashCommandsResult = {
  /** Texto sem as linhas/trechos de comandos (para intake/LLM não confundir). */
  cleanedText: string;
  commands: ParsedSlashCommand[];
};

const COMMAND_RE = /(?:^|\s)\/?(autora|autor|reu|réu|fato|pedido|urgencia|documento|risco|observacao|prazo|valor)\b/giu;

/**
 * Parser tolerante para comandos slash no relato.
 *
 * Suporta:
 * - com e sem barra: `/fato: ...` ou `fato: ...`
 * - separadores variados `:`, `-`, `–` ou espaço
 * - múltiplos comandos na mesma linha
 *
 * Retorna `cleanedText` removendo os trechos de comandos para que o intake
 * determinístico não confunda "Autor:" com "fato", etc.
 */
export function parseSlashCommands(rawText: string): ParseSlashCommandsResult {
  const text = (rawText ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { cleanedText: "", commands: [] };

  const commands: ParsedSlashCommand[] = [];
  const keptLines: string[] = [];

  for (const line of text.split("\n")) {
    const matches = Array.from(line.matchAll(COMMAND_RE));
    if (matches.length === 0) {
      keptLines.push(line);
      continue;
    }

    // Se o comando aparece como "linha de comando" (início), tratamos como
    // instrução e removemos a linha inteira do cleanedText.
    const startsWithCommand = /^\s*\/?(autora|autor|reu|réu|fato|pedido|urgencia|documento|risco|observacao|prazo|valor)\b/i.test(
      line,
    );

    // Tokeniza em segmentos: cada comando captura do fim do token até o
    // próximo comando (ou fim da linha).
    for (let i = 0; i < matches.length; i += 1) {
      const m = matches[i];
      if (!m) continue;
      const name = (m?.[1] ?? "").toLowerCase() as SlashCommandName;
      const startIdx = m.index ?? 0;
      const nextIdx = matches[i + 1]?.index ?? line.length;

      // Segmento do comando até antes do próximo comando.
      const segment = line.slice(startIdx, nextIdx);
      const afterName = segment.replace(COMMAND_RE, "").trim();
      const value = afterName.replace(/^[:\-–]\s*/, "").trim();
      if (!value) continue;

      commands.push({ name, value, sourceText: segment.trim() });
    }

    // Se o comando está no começo, removemos a linha inteira do texto "limpo".
    // Caso contrário, mantemos a linha original — ela provavelmente é narrativa
    // com um comando inline, e remover tudo seria agressivo.
    if (!startsWithCommand) keptLines.push(line);
  }

  const cleanedText = keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cleanedText, commands };
}

