type JSONContent = Record<string, unknown>;

/** Conversão simples de texto bruto → TipTap JSON (parágrafos). */
export function tiptapDocFromPlainText(text: string): JSONContent {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const paras: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (buf.length) {
        paras.push(buf.join(" ").trim());
        buf = [];
      }
      continue;
    }
    buf.push(line.trim());
  }
  if (buf.length) paras.push(buf.join(" ").trim());

  return {
    type: "doc",
    content: (paras.length ? paras : [""]).map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    })),
  };
}

