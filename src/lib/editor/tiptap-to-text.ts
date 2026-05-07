type JSONContent = Record<string, unknown>;

function walk(node: unknown, out: string[]) {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n["type"] === "text" && typeof n["text"] === "string") {
    out.push(n["text"]);
    return;
  }
  const content = n["content"];
  if (Array.isArray(content)) {
    for (const child of content) walk(child, out);
  }
}

export function tiptapPlainText(json: JSONContent): string {
  const parts: string[] = [];
  walk(json, parts);
  const text = parts.join("");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

