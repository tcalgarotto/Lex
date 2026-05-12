import { describe, expect, it } from "vitest";
import { markdownToTipTapDoc } from "@/lib/cases/drafting/markdown-to-tiptap-doc";

describe("markdownToTipTapDoc", () => {
  it("converte títulos e parágrafos", () => {
    const doc = markdownToTipTapDoc("# A\n\nCorpo.\n## B");
    expect(doc["type"]).toBe("doc");
    const c = doc["content"] as Array<{ type: string; attrs?: { level?: number }; content?: Array<{ text?: string }> }>;
    expect(c[0]?.type).toBe("heading");
    expect(c[0]?.attrs?.level).toBe(1);
    expect(c.some((n) => n.type === "paragraph")).toBe(true);
  });

  it("não retorna doc vazio", () => {
    const doc = markdownToTipTapDoc("");
    expect(Array.isArray(doc["content"])).toBe(true);
    expect((doc["content"] as unknown[]).length).toBeGreaterThan(0);
  });
});
