/**
 * Conversão mínima de Markdown de minuta para JSON do TipTap (StarterKit).
 * Preserva títulos (#/##/###) e parágrafos; demais linhas viram parágrafo simples.
 */

type PMNode = Record<string, unknown>;

function textParagraph(text: string): PMNode {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function heading(level: 1 | 2 | 3, text: string): PMNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

export function markdownToTipTapDoc(markdown: string): Record<string, unknown> {
  const content: PMNode[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("### ")) content.push(heading(3, t.slice(4).trim()));
    else if (t.startsWith("## ")) content.push(heading(2, t.slice(3).trim()));
    else if (t.startsWith("# ")) content.push(heading(1, t.slice(2).trim()));
    else if (t.startsWith("> ")) content.push(textParagraph(t.slice(2).trim()));
    else content.push(textParagraph(t));
  }
  if (content.length === 0) {
    content.push(textParagraph(""));
  }
  return { type: "doc", content };
}
